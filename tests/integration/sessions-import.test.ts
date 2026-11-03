import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createTestUsers,
  deleteTestUsers,
  setupTestDatabase,
  testDatabaseUrl,
} from "../support/db";
import { db } from "@/src/lib/db";
import { focusSession, learningDraft, task } from "@/src/lib/db/schema";
import { createSession, todaySummary } from "@/src/features/sessions/server";
import {
  correctClockSkew,
  sessionCreateSchema,
} from "@/src/features/sessions/schema";
import { importLocalData } from "@/src/features/import/server";
import { importSchema } from "@/src/features/import/schema";
import { createTask } from "@/src/features/tasks/server";

vi.mock("@/src/features/analytics/server", () => ({
  captureProductEvent: vi.fn(),
  recordTaskCompleted: vi.fn(),
}));

const A = "si-user-a";
const B = "si-user-b";
beforeAll(async () => {
  if (!(await setupTestDatabase())) return;
  await createTestUsers(A, B);
});
afterAll(async () => {
  if (testDatabaseUrl) await deleteTestUsers(A, B);
  vi.unstubAllEnvs();
});

function sessionInput(overrides: Record<string, unknown> = {}) {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 60_000);
  return sessionCreateSchema.parse({
    clientId: crypto.randomUUID(),
    mode: "work",
    timeTechnique: "pomodoro",
    goal: "Write",
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    focusedSeconds: 1500,
    breakSeconds: 300,
    cyclesCompleted: 1,
    interruptions: 0,
    overrunSeconds: 0,
    focusRating: 4,
    ...overrides,
  });
}

describe("session validation", () => {
  it("rejects impossible sessions", () => {
    const now = Date.now();
    const base = {
      clientId: crypto.randomUUID(),
      mode: "work",
      timeTechnique: "pomodoro",
      breakSeconds: 0,
      cyclesCompleted: 0,
      interruptions: 0,
      overrunSeconds: 0,
    };
    expect(
      sessionCreateSchema.safeParse({
        ...base,
        startedAt: new Date(now - 600_000).toISOString(),
        endedAt: new Date(now).toISOString(),
        focusedSeconds: 3600,
      }).success,
    ).toBe(false);
    expect(
      sessionCreateSchema.safeParse({
        ...base,
        startedAt: new Date(now).toISOString(),
        endedAt: new Date(now - 1000).toISOString(),
        focusedSeconds: 0,
      }).success,
    ).toBe(false);
    expect(
      sessionCreateSchema.safeParse({
        ...base,
        startedAt: new Date(now + 2 * 86_400_000).toISOString(),
        endedAt: new Date(now + 2 * 86_400_000 + 60_000).toISOString(),
        focusedSeconds: 60,
      }).success,
    ).toBe(false);
    expect(
      sessionCreateSchema.safeParse({
        ...base,
        mode: "learning",
        startedAt: new Date(now - 60_000).toISOString(),
        endedAt: new Date(now).toISOString(),
        focusedSeconds: 60,
      }).success,
    ).toBe(false);
  });
});

it("shifts sessions from devices whose clock runs ahead", () => {
  const now = Date.parse("2026-11-02T10:00:00Z");
  const fixed = correctClockSkew(
    "2026-11-02T09:40:00Z",
    "2026-11-02T10:10:00Z",
    now,
  );
  expect(fixed.endedAt.toISOString()).toBe("2026-11-02T10:00:00.000Z");
  expect(fixed.startedAt.toISOString()).toBe("2026-11-02T09:30:00.000Z");
  expect(
    correctClockSkew(
      "2026-11-02T09:00:00Z",
      "2026-11-02T09:30:00Z",
      now,
    ).endedAt.toISOString(),
  ).toBe("2026-11-02T09:30:00.000Z");
});

describe.skipIf(!testDatabaseUrl)("sessions", () => {
  it("is idempotent per client id and updates today's summary", async () => {
    const input = sessionInput();
    const first = await createSession(A, input);
    const second = await createSession(A, input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    const summary = await todaySummary(A, "UTC");
    expect(summary.focusedSeconds).toBeGreaterThanOrEqual(1500);
    expect(summary.streak).toBeGreaterThanOrEqual(1);
  });

  it("never links or completes another user's task", async () => {
    const theirs = await createTask(B, { title: "B's task" });
    const { session } = await createSession(
      A,
      sessionInput({ taskId: theirs.id, taskDone: true }),
    );
    expect(session.taskId).toBeNull();
    const [row] = await db().select().from(task).where(eq(task.id, theirs.id));
    expect(row.status).toBe("todo");
  });

  it("marks the user's own task done and creates a learning draft", async () => {
    const mine = await createTask(A, { title: "Mine" });
    await createSession(A, sessionInput({ taskId: mine.id, taskDone: true }));
    const [row] = await db().select().from(task).where(eq(task.id, mine.id));
    expect(row.status).toBe("done");
    const learning = await createSession(
      A,
      sessionInput({
        mode: "learning",
        learningMethod: "cornell",
        learning: { topic: "Photosynthesis", notes: {} },
      }),
    );
    const drafts = await db()
      .select()
      .from(learningDraft)
      .where(eq(learningDraft.sessionId, learning.session.id));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].userId).toBe(A);
  });
});

describe.skipIf(!testDatabaseUrl)("anonymous import", () => {
  it("imports tasks and sessions once, linking sessions to imported tasks", async () => {
    const taskClientId = crypto.randomUUID();
    const sessionClientId = crypto.randomUUID();
    const now = new Date();
    const payload = importSchema.parse({
      tasks: [
        {
          clientId: taskClientId,
          title: "Local task",
          status: "todo",
          tags: ["study"],
          createdAt: now.toISOString(),
        },
      ],
      sessions: [
        {
          clientId: sessionClientId,
          mode: "work",
          timeTechnique: "52-17",
          taskClientId,
          goal: "",
          startedAt: new Date(now.getTime() - 3_600_000).toISOString(),
          endedAt: now.toISOString(),
          focusedSeconds: 3120,
          breakSeconds: 0,
          cyclesCompleted: 1,
          interruptions: 0,
          overrunSeconds: 0,
          focusRating: 5,
          note: null,
        },
      ],
    });
    expect(await importLocalData(A, payload)).toEqual({
      tasks: 1,
      sessions: 1,
    });
    expect(await importLocalData(A, payload)).toEqual({
      tasks: 0,
      sessions: 0,
    });
    const [imported] = await db()
      .select()
      .from(focusSession)
      .where(
        and(
          eq(focusSession.userId, A),
          eq(focusSession.clientId, sessionClientId),
        ),
      );
    const [linked] = await db()
      .select()
      .from(task)
      .where(eq(task.id, imported.taskId!));
    expect(linked.clientId).toBe(taskClientId);
    // The same device data imported into another account stays separate.
    expect(await importLocalData(B, payload)).toEqual({
      tasks: 1,
      sessions: 1,
    });
  });

  it("rejects oversized or malformed payloads", () => {
    expect(
      importSchema.safeParse({ tasks: [], sessions: [], extra: 1 }).success,
    ).toBe(false);
    expect(
      importSchema.safeParse({
        tasks: Array.from({ length: 501 }, () => ({})),
        sessions: [],
      }).success,
    ).toBe(false);
  });
});
