import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import {
  createTestUsers,
  deleteTestUsers,
  setupTestDatabase,
  testDatabaseUrl,
} from "../support/db";
import { mockOpenAI } from "../support/ai-mock";
import { db } from "@/src/lib/db";
import {
  learningItem,
  question,
  review,
  reviewAnswer,
} from "@/src/lib/db/schema";
import { resetAiClient } from "@/src/lib/ai";
import {
  countDue,
  dueCards,
  gradeAnswer,
  ReviewError,
  submitReview,
} from "@/src/features/reviews/server";
import { deleteCard, getCard, updateCard } from "@/src/features/cards/server";

vi.mock("@/src/features/analytics/server", () => ({
  captureProductEvent: vi.fn(),
  recordTaskCompleted: vi.fn(),
}));
vi.mock("@/src/lib/billing/entitlements", () => ({
  hasEntitlement: vi.fn(async () => false),
}));

const A = "rv-user-a";
const B = "rv-user-b";
const prefs = { timezone: "UTC", reviewSteps: [5, 10, 30] };

beforeAll(async () => {
  if (!(await setupTestDatabase())) return;
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("AI_BASE_URL", "https://ai.mock.test/v1");
  await createTestUsers(A, B);
});
beforeEach(() => resetAiClient());
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  if (testDatabaseUrl) await deleteTestUsers(A, B);
  vi.unstubAllEnvs();
});

async function card(userId: string, dueOn: string) {
  const id = crypto.randomUUID();
  await db().insert(learningItem).values({
    id,
    userId,
    topic: "Cells",
    learningMethod: "feynman",
    explanation: "Cells make energy in mitochondria.",
    intervalDays: 5,
    dueOn,
  });
  const ids = {
    tf: crypto.randomUUID(),
    cloze: crypto.randomUUID(),
    open: crypto.randomUUID(),
  };
  await db()
    .insert(question)
    .values([
      {
        id: ids.tf,
        learningItemId: id,
        type: "true_false",
        prompt: "Cells need energy.",
        answer: "true",
        position: 0,
      },
      {
        id: ids.cloze,
        learningItemId: id,
        type: "cloze",
        prompt: "Energy is made in the ____.",
        answer: "mitochondria",
        position: 1,
      },
      {
        id: ids.open,
        learningItemId: id,
        type: "open",
        prompt: "Why do cells need energy?",
        answer: "To do work.",
        position: 2,
      },
    ]);
  return { id, ids };
}

describe.skipIf(!testDatabaseUrl)("reviews", () => {
  it("passes a due card, regrading rule questions on the server, and advances the schedule", async () => {
    const { id, ids } = await card(A, "2026-11-07");
    const result = await submitReview(
      A,
      {
        cardId: id,
        clientId: crypto.randomUUID(),
        answers: [
          {
            questionId: ids.tf,
            answer: "TRUE",
            verdict: "incorrect",
            gradedBy: "rule",
          },
          { questionId: ids.cloze, answer: "Mitochondira", gradedBy: "rule" },
          {
            questionId: ids.open,
            answer: "to work",
            verdict: "correct",
            gradedBy: "self",
          },
        ],
      },
      prefs,
      "2026-11-07",
    );
    expect(result).toMatchObject({
      passed: true,
      scorePct: 100,
      nextDueOn: "2026-11-12",
      early: false,
    });
    const [row] = await db()
      .select()
      .from(learningItem)
      .where(eq(learningItem.id, id));
    expect(row).toMatchObject({
      currentStep: 1,
      dueOn: "2026-11-12",
      reviewCount: 1,
      lapseCount: 0,
    });
  });

  it("fails into a 2-day relearn at the same step; partial counts as a miss", async () => {
    const { id, ids } = await card(A, "2026-11-07");
    const result = await submitReview(
      A,
      {
        cardId: id,
        clientId: crypto.randomUUID(),
        answers: [
          { questionId: ids.tf, answer: "true", gradedBy: "rule" },
          { questionId: ids.cloze, answer: "mitochondria", gradedBy: "rule" },
          {
            questionId: ids.open,
            answer: "dunno",
            verdict: "partial",
            gradedBy: "ai",
            feedback: "Close.",
          },
        ],
      },
      prefs,
      "2026-11-08",
    );
    expect(result).toMatchObject({
      passed: false,
      scorePct: 83,
      nextDueOn: "2026-11-10",
    });
    const [row] = await db()
      .select()
      .from(learningItem)
      .where(eq(learningItem.id, id));
    expect(row).toMatchObject({ currentStep: 0, relearn: true, lapseCount: 1 });
    const answers = await db()
      .select()
      .from(reviewAnswer)
      .innerJoin(review, eq(review.id, reviewAnswer.reviewId))
      .where(eq(review.learningItemId, id));
    expect(
      answers.find((a) => a.review_answer.questionId === ids.open)
        ?.review_answer,
    ).toMatchObject({ gradedBy: "ai", verdict: "partial" });
  });

  it("records early practice without moving the schedule, and is idempotent", async () => {
    const { id, ids } = await card(A, "2026-12-01");
    const clientId = crypto.randomUUID();
    const input = {
      cardId: id,
      clientId,
      answers: [
        { questionId: ids.tf, answer: "false", gradedBy: "rule" as const },
      ],
    };
    const first = await submitReview(A, input, prefs, "2026-11-20");
    const second = await submitReview(A, input, prefs, "2026-11-20");
    expect(first).toMatchObject({
      early: true,
      nextDueOn: "2026-12-01",
      passed: false,
    });
    expect(second.nextDueOn).toBe("2026-12-01");
    expect(
      await db().select().from(review).where(eq(review.learningItemId, id)),
    ).toHaveLength(1);
    const [row] = await db()
      .select()
      .from(learningItem)
      .where(eq(learningItem.id, id));
    expect(row).toMatchObject({ dueOn: "2026-12-01", lapseCount: 0 });
  });

  it("lists due and overdue cards in the user's queue only", async () => {
    await card(B, "2026-11-01");
    const due = await dueCards(B, "2026-11-05");
    expect(due.length).toBeGreaterThanOrEqual(1);
    expect(due.every((c) => c.questions.length === 3)).toBe(true);
    expect(await countDue(B, "2026-10-01")).toBe(0);
  });

  it("keeps a card private: another user cannot read, edit or delete it", async () => {
    const { id } = await card(A, "2026-01-01");
    expect(await getCard(B, id)).toBeUndefined();
    expect(
      await updateCard(B, id, {
        topic: "Taken over",
        questions: [
          {
            type: "open",
            prompt: "New?",
            answer: "Yes",
            explanation: "",
            source: "user",
          },
        ],
      }),
    ).toBeUndefined();
    expect(await deleteCard(B, id)).toBe(false);
    const own = await getCard(A, id);
    expect(own?.card.topic).toBe("Cells");
    expect(own?.questions).toHaveLength(3);
  });

  it("denies reviewing or grading another user's card", async () => {
    const { id, ids } = await card(B, "2026-11-07");
    await expect(
      submitReview(
        A,
        {
          cardId: id,
          clientId: crypto.randomUUID(),
          answers: [{ questionId: ids.tf, answer: "true", gradedBy: "rule" }],
        },
        prefs,
        "2026-11-07",
      ),
    ).rejects.toBeInstanceOf(ReviewError);
    expect(
      await gradeAnswer(A, { questionId: ids.open, answer: "x" }, "en", "UTC"),
    ).toMatchObject({ ok: false, status: 404 });
  });

  it("grades open answers with AI and falls back when AI fails", async () => {
    const { ids } = await card(A, "2026-11-07");
    mockOpenAI([
      {
        content: {
          verdict: "correct",
          feedback: "Yes, cells use energy to do work.",
        },
      },
    ]);
    expect(
      await gradeAnswer(
        A,
        { questionId: ids.open, answer: "So they can work" },
        "en",
        "UTC",
      ),
    ).toEqual({
      ok: true,
      verdict: "correct",
      feedback: "Yes, cells use energy to do work.",
    });
    resetAiClient();
    mockOpenAI([
      { content: "", status: 500 },
      { content: "", status: 500 },
    ]);
    expect(
      await gradeAnswer(A, { questionId: ids.open, answer: "x" }, "en", "UTC"),
    ).toMatchObject({ ok: false, error: "ai_unavailable" });
  });
});
