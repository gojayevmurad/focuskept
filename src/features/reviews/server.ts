import "server-only";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  learningItem,
  question,
  review,
  reviewAnswer,
} from "@/src/lib/db/schema";
import { captureProductEvent } from "@/src/features/analytics/server";
import { aiConfigured, AiError, gradeOpenAnswer } from "@/src/lib/ai";
import {
  budgetBlocked,
  getPlan,
  recordAiUsage,
  usagePeriod,
} from "@/src/features/limits/server";
import { DAILY_GRADING_LIMIT } from "@/src/features/limits/rules";
import { rateLimit } from "@/src/lib/security/rate-limit";
import { gradeByRule, reviewResult, type Verdict } from "./grading";
import { scheduleAfterReview } from "./scheduler";
import { subjectCondition } from "@/src/features/subjects/server";
import type { ReviewSubmit } from "./schema";

export type ReviewCard = {
  id: string;
  topic: string;
  explanation: string;
  dueOn: string;
  currentStep: number;
  questions: {
    id: string;
    type: "open" | "true_false" | "cloze";
    prompt: string;
    answer: string;
    explanation: string | null;
  }[];
};

async function withQuestions(
  cards: (typeof learningItem.$inferSelect)[],
): Promise<ReviewCard[]> {
  if (!cards.length) return [];
  const rows = await db()
    .select()
    .from(question)
    .where(
      inArray(
        question.learningItemId,
        cards.map((c) => c.id),
      ),
    )
    .orderBy(asc(question.position));
  return cards
    .map((c) => ({
      id: c.id,
      topic: c.topic,
      explanation: c.explanation,
      dueOn: c.dueOn,
      currentStep: c.currentStep,
      questions: rows
        .filter((q) => q.learningItemId === c.id)
        .map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          answer: q.answer,
          explanation: q.explanation,
        })),
    }))
    .filter((c) => c.questions.length > 0);
}

/** Active cards due on or before `today` (overdue first). */
export async function dueCards(
  userId: string,
  today: string,
  limit = 50,
  subject?: string,
) {
  const cards = await db()
    .select()
    .from(learningItem)
    .where(
      and(
        eq(learningItem.userId, userId),
        eq(learningItem.status, "active"),
        lte(learningItem.dueOn, today),
        subject ? subjectCondition(subject) : undefined,
      ),
    )
    .orderBy(asc(learningItem.dueOn), asc(learningItem.createdAt))
    .limit(limit);
  return withQuestions(cards);
}

export async function countDue(
  userId: string,
  today: string,
  subject?: string,
) {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(learningItem)
    .where(
      and(
        eq(learningItem.userId, userId),
        eq(learningItem.status, "active"),
        lte(learningItem.dueOn, today),
        subject ? subjectCondition(subject) : undefined,
      ),
    );
  return row.n;
}

export async function cardForReview(userId: string, cardId: string) {
  const cards = await db()
    .select()
    .from(learningItem)
    .where(and(eq(learningItem.userId, userId), eq(learningItem.id, cardId)));
  return (await withQuestions(cards))[0];
}

export class ReviewError extends Error {
  constructor(public code: "not_found" | "invalid_answers") {
    super(code);
  }
}

/**
 * Records a review and applies the scheduler. True/false and cloze answers are
 * graded again on the server; open answers keep the AI or self grade (the
 * learner may always grade themselves). Idempotent by clientId.
 */
export async function submitReview(
  userId: string,
  input: ReviewSubmit,
  prefs: { timezone: string; reviewSteps: number[] },
  today: string,
) {
  const result = await db().transaction(async (tx) => {
    const [card] = await tx
      .select()
      .from(learningItem)
      .where(
        and(eq(learningItem.userId, userId), eq(learningItem.id, input.cardId)),
      )
      .for("update");
    if (!card) throw new ReviewError("not_found");
    const [existing] = await tx
      .select()
      .from(review)
      .where(
        and(eq(review.userId, userId), eq(review.clientId, input.clientId)),
      );
    if (existing)
      return {
        review: existing,
        card,
        verdicts: [] as { questionId: string; verdict: Verdict }[],
        duplicate: true,
      };
    const questions = await tx
      .select()
      .from(question)
      .where(eq(question.learningItemId, card.id));
    const byId = new Map(questions.map((q) => [q.id, q]));
    if (input.answers.some((a) => !byId.has(a.questionId)))
      throw new ReviewError("invalid_answers");
    const graded = input.answers.map((a) => {
      const q = byId.get(a.questionId)!;
      if (q.type === "open")
        return {
          ...a,
          verdict: a.verdict ?? ("incorrect" as Verdict),
          gradedBy: a.gradedBy === "rule" ? ("self" as const) : a.gradedBy,
        };
      return {
        ...a,
        verdict: gradeByRule(q.type, a.answer, q.answer),
        gradedBy: "rule" as const,
        feedback: undefined,
      };
    });
    const { passed, scorePct } = reviewResult(graded.map((g) => g.verdict));
    const next = scheduleAfterReview(
      {
        step: card.currentStep,
        intervalDays: card.intervalDays,
        dueOn: card.dueOn,
        relearn: card.relearn,
      },
      { passed, today, steps: prefs.reviewSteps },
    );
    const id = crypto.randomUUID();
    const [row] = await tx
      .insert(review)
      .values({
        id,
        learningItemId: card.id,
        userId,
        scheduledOn: card.dueOn,
        scorePct,
        passed,
        stepBefore: card.currentStep,
        stepAfter: next.step,
        nextDueOn: next.dueOn,
        wasRelearn: card.relearn,
        wasEarly: next.early,
        clientId: input.clientId,
      })
      .returning();
    await tx.insert(reviewAnswer).values(
      graded.map((g) => ({
        id: crypto.randomUUID(),
        reviewId: id,
        questionId: g.questionId,
        answer: g.answer,
        verdict: g.verdict,
        feedback: g.feedback ?? null,
        gradedBy: g.gradedBy,
      })),
    );
    const [updated] = await tx
      .update(learningItem)
      .set({
        currentStep: next.step,
        intervalDays: next.intervalDays,
        dueOn: next.dueOn,
        relearn: next.relearn,
        lastReviewedAt: new Date(),
        reviewCount: sql`${learningItem.reviewCount} + 1`,
        lapseCount:
          !passed && !next.early
            ? sql`${learningItem.lapseCount} + 1`
            : learningItem.lapseCount,
        updatedAt: new Date(),
      })
      .where(eq(learningItem.id, card.id))
      .returning();
    return {
      review: row,
      card: updated,
      verdicts: graded.map((g) => ({
        questionId: g.questionId,
        verdict: g.verdict,
      })),
      duplicate: false,
    };
  });
  if (!result.duplicate)
    await captureProductEvent(userId, "core_action_completed", {
      feature: "review_completed",
    });
  return {
    passed: result.review.passed,
    scorePct: result.review.scorePct,
    nextDueOn: result.review.nextDueOn,
    early: result.review.wasEarly,
    verdicts: result.verdicts,
  };
}

export type GradeOutcome =
  | { ok: true; verdict: Verdict; feedback: string }
  | {
      ok: false;
      status: number;
      error: "not_found" | "ai_unavailable" | "grading_limit";
    };

/** AI grading for an open answer, against the stored answer and the learner's own explanation. */
export async function gradeAnswer(
  userId: string,
  input: { questionId: string; answer: string },
  locale: string,
  timezone: string,
): Promise<GradeOutcome> {
  const [row] = await db()
    .select({
      question,
      explanation: learningItem.explanation,
      language: learningItem.language,
    })
    .from(question)
    .innerJoin(learningItem, eq(learningItem.id, question.learningItemId))
    .where(
      and(eq(question.id, input.questionId), eq(learningItem.userId, userId)),
    );
  if (!row) return { ok: false, status: 404, error: "not_found" };
  if (row.question.type !== "open") {
    return {
      ok: true,
      verdict: gradeByRule(
        row.question.type,
        input.answer,
        row.question.answer,
      ),
      feedback: "",
    };
  }
  if (!aiConfigured() || (await budgetBlocked((await getPlan(userId)).pro)))
    return { ok: false, status: 503, error: "ai_unavailable" };
  const daily = await rateLimit(
    `ai-grade-day:${userId}`,
    DAILY_GRADING_LIMIT,
    86_400,
  );
  if (!daily.allowed) return { ok: false, status: 429, error: "grading_limit" };
  try {
    const { result, usage } = await gradeOpenAnswer({
      question: row.question.prompt,
      modelAnswer: row.question.answer,
      explanation: row.explanation,
      userAnswer: input.answer,
      locale: row.language ?? locale,
    });
    await recordAiUsage(userId, usagePeriod(timezone), usage, "grading");
    return {
      ok: true,
      verdict: result.verdict,
      feedback: result.feedback.slice(0, 500),
    };
  } catch (error) {
    if (!(error instanceof AiError)) throw error;
    await recordAiUsage(userId, usagePeriod(timezone), error.usage, "grading");
    return { ok: false, status: 503, error: "ai_unavailable" };
  }
}

export async function nextDueDate(userId: string) {
  const [row] = await db()
    .select({ dueOn: sql<string | null>`min(${learningItem.dueOn})::text` })
    .from(learningItem)
    .where(
      and(eq(learningItem.userId, userId), eq(learningItem.status, "active")),
    );
  return row?.dueOn ?? null;
}
