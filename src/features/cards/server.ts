import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  focusSession,
  learningDraft,
  learningItem,
  question,
  review,
  reviewAnswer,
} from "@/src/lib/db/schema";
import { getPreferences, today } from "@/src/features/preferences/server";
import { captureProductEvent } from "@/src/features/analytics/server";
import { cardLimit } from "@/src/features/limits/rules";
import { countCards, getPlan, LimitError } from "@/src/features/limits/server";
import { initialSchedule } from "@/src/features/reviews/scheduler";
import type { QuestionInput } from "./schema";

export type Card = typeof learningItem.$inferSelect;
export type Question = typeof question.$inferSelect;

export async function getDraftBySession(userId: string, sessionId: string) {
  const [row] = await db()
    .select()
    .from(learningDraft)
    .where(
      and(
        eq(learningDraft.userId, userId),
        eq(learningDraft.sessionId, sessionId),
      ),
    );
  return row;
}

export async function saveDraftExplanation(
  userId: string,
  sessionId: string,
  explanation: string,
) {
  const rows = await db()
    .update(learningDraft)
    .set({ explanation, updatedAt: new Date() })
    .where(
      and(
        eq(learningDraft.userId, userId),
        eq(learningDraft.sessionId, sessionId),
      ),
    )
    .returning({ id: learningDraft.id });
  return rows.length > 0;
}

/** Saves a Learning session's draft as a scheduled knowledge card. */
export async function createCardFromDraft(
  userId: string,
  input: { sessionId: string; explanation: string; questions: QuestionInput[] },
) {
  const plan = await getPlan(userId);
  const prefs = await getPreferences(userId);
  const card = await db().transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(learningDraft)
      .where(
        and(
          eq(learningDraft.userId, userId),
          eq(learningDraft.sessionId, input.sessionId),
        ),
      )
      .for("update");
    if (!draft) throw new LimitError("not_found");
    // Serialize card creation per user so the cap can't be raced.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"cards:" + userId}, 0))`,
    );
    if ((await countCards(userId)) >= cardLimit(plan))
      throw new LimitError("card_limit");
    const schedule = initialSchedule(today(prefs), prefs.reviewSteps);
    const id = crypto.randomUUID();
    const [row] = await tx
      .insert(learningItem)
      .values({
        id,
        userId,
        sessionId: draft.sessionId,
        topic: draft.topic,
        sourceUrl: draft.sourceUrl,
        learningMethod: draft.learningMethod,
        explanation: input.explanation,
        analysis: draft.analysis,
        language: draft.language,
        promptVersion: draft.analysis ? draft.promptVersion : null,
        currentStep: schedule.step,
        intervalDays: schedule.intervalDays,
        dueOn: schedule.dueOn,
      })
      .returning();
    await tx.insert(question).values(
      input.questions.map((q, position) => ({
        id: crypto.randomUUID(),
        learningItemId: id,
        type: q.type,
        prompt: q.prompt,
        answer: q.type === "true_false" ? q.answer.toLowerCase() : q.answer,
        explanation: q.explanation || null,
        position,
        source: q.source,
      })),
    );
    await tx
      .update(focusSession)
      .set({ learningItemId: id, updatedAt: new Date() })
      .where(
        and(
          eq(focusSession.userId, userId),
          eq(focusSession.id, draft.sessionId),
        ),
      );
    await tx.delete(learningDraft).where(eq(learningDraft.id, draft.id));
    return row;
  });
  await captureProductEvent(userId, "core_action_completed", {
    feature: "card_created",
  });
  return card;
}

export type CardFilters = {
  q?: string;
  status?: "active" | "archived";
  topic?: string;
  sort?: "due" | "new";
  cursor?: string;
  limit?: number;
};

/** Prefix search over topic + explanation (Postgres `simple` config: works in every language). */
function searchCondition(q: string): SQL | undefined {
  const terms = q
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8)
    .map((t) => `${t.toLowerCase()}:*`);
  if (!terms.length) return undefined;
  return or(
    sql`${learningItem.search} @@ to_tsquery('simple', ${terms.join(" & ")})`,
    sql`${learningItem.topic} ilike ${"%" + q.replace(/[%_\\]/g, (c) => "\\" + c) + "%"}`,
  );
}

/** Keyset-paginated card list. Cursor: "<dueOn|createdAt>|<id>". */
export async function listCards(userId: string, filters: CardFilters = {}) {
  const limit = Math.min(filters.limit ?? 50, 100);
  const sort = filters.sort ?? "due";
  const conditions: (SQL | undefined)[] = [
    eq(learningItem.userId, userId),
    eq(learningItem.status, filters.status ?? "active"),
  ];
  if (filters.topic) conditions.push(eq(learningItem.topic, filters.topic));
  if (filters.q) conditions.push(searchCondition(filters.q));
  if (filters.cursor) {
    const [key, id] = filters.cursor.split("|");
    if (key && id)
      conditions.push(
        sort === "due"
          ? or(
              gt(learningItem.dueOn, key),
              and(eq(learningItem.dueOn, key), gt(learningItem.id, id)),
            )
          : sql`(${learningItem.createdAt}, ${learningItem.id}) < (${new Date(key)}, ${id})`,
      );
  }
  const rows = await db()
    .select({
      id: learningItem.id,
      topic: learningItem.topic,
      status: learningItem.status,
      dueOn: learningItem.dueOn,
      currentStep: learningItem.currentStep,
      reviewCount: learningItem.reviewCount,
      createdAt: learningItem.createdAt,
      learningMethod: learningItem.learningMethod,
      clarity: sql<
        number | null
      >`(${learningItem.analysis} ->> 'clarityScore')::int`,
      questions: sql<number>`(select count(*)::int from ${question} where ${question.learningItemId} = ${learningItem.id})`,
    })
    .from(learningItem)
    .where(and(...conditions))
    .orderBy(
      ...(sort === "due"
        ? [asc(learningItem.dueOn), asc(learningItem.id)]
        : [desc(learningItem.createdAt), desc(learningItem.id)]),
    )
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    cards: page,
    nextCursor:
      rows.length > limit && last
        ? `${sort === "due" ? last.dueOn : last.createdAt.toISOString()}|${last.id}`
        : null,
  };
}

export async function listTopics(userId: string) {
  const rows = await db()
    .selectDistinct({ topic: learningItem.topic })
    .from(learningItem)
    .where(eq(learningItem.userId, userId))
    .orderBy(asc(learningItem.topic))
    .limit(500);
  return rows.map((r) => r.topic);
}

export async function getCard(userId: string, id: string) {
  const [card] = await db()
    .select()
    .from(learningItem)
    .where(and(eq(learningItem.userId, userId), eq(learningItem.id, id)));
  if (!card) return undefined;
  const questions = await db()
    .select()
    .from(question)
    .where(eq(question.learningItemId, id))
    .orderBy(asc(question.position));
  const reviews = await db()
    .select()
    .from(review)
    .where(and(eq(review.userId, userId), eq(review.learningItemId, id)))
    .orderBy(desc(review.completedAt))
    .limit(50);
  return { card, questions, reviews };
}

export async function updateCard(
  userId: string,
  id: string,
  patch: {
    topic?: string;
    explanation?: string;
    status?: "active" | "archived";
    questions?: QuestionInput[];
  },
) {
  return db().transaction(async (tx) => {
    const [row] = await tx
      .update(learningItem)
      .set({
        topic: patch.topic,
        explanation: patch.explanation,
        status: patch.status,
        updatedAt: new Date(),
      })
      .where(and(eq(learningItem.userId, userId), eq(learningItem.id, id)))
      .returning();
    if (!row) return undefined;
    if (patch.questions) {
      const existing = await tx
        .select()
        .from(question)
        .where(eq(question.learningItemId, id));
      const keep = new Set(patch.questions.map((q) => q.id).filter(Boolean));
      const removed = existing.filter((q) => !keep.has(q.id)).map((q) => q.id);
      if (removed.length)
        await tx.delete(question).where(inArray(question.id, removed));
      for (const [position, q] of patch.questions.entries()) {
        const current = existing.find((e) => e.id === q.id);
        const values = {
          type: q.type,
          prompt: q.prompt,
          answer: q.type === "true_false" ? q.answer.toLowerCase() : q.answer,
          explanation: q.explanation || null,
          position,
        };
        if (current) {
          const changed =
            current.prompt !== q.prompt ||
            current.answer !== values.answer ||
            current.type !== q.type;
          await tx
            .update(question)
            .set({
              ...values,
              source:
                changed && current.source === "ai"
                  ? "ai_edited"
                  : current.source,
              updatedAt: new Date(),
            })
            .where(eq(question.id, current.id));
        } else
          await tx.insert(question).values({
            id: crypto.randomUUID(),
            learningItemId: id,
            source: "user",
            ...values,
          });
      }
    }
    return row;
  });
}

export async function deleteCard(userId: string, id: string) {
  const rows = await db()
    .delete(learningItem)
    .where(and(eq(learningItem.userId, userId), eq(learningItem.id, id)))
    .returning({ id: learningItem.id });
  return rows.length > 0;
}

export async function reviewAnswersFor(reviewIds: string[]) {
  if (!reviewIds.length) return [];
  return db()
    .select()
    .from(reviewAnswer)
    .where(inArray(reviewAnswer.reviewId, reviewIds));
}

/**
 * Leitner-style view of the spaced schedule: cards due today, then the
 * cards waiting at each review step, then graduated ones.
 */
export async function cardBoxes(
  userId: string,
  today: string,
  steps: readonly number[],
) {
  const rows = await db()
    .select({
      due: sql<boolean>`${learningItem.dueOn} <= ${today}`,
      step: learningItem.currentStep,
      n: sql<number>`count(*)::int`,
    })
    .from(learningItem)
    .where(
      and(eq(learningItem.userId, userId), eq(learningItem.status, "active")),
    )
    .groupBy(sql`1`, learningItem.currentStep);
  const boxes = [0, ...steps.map(() => 0), 0];
  for (const r of rows) {
    if (r.due) boxes[0] += r.n;
    else boxes[1 + Math.min(r.step, steps.length)] += r.n;
  }
  return boxes;
}
