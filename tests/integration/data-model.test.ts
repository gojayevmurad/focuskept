import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, getTableName, sql } from "drizzle-orm";
import {
  createTestUsers,
  deleteTestUsers,
  setupTestDatabase,
  testDatabaseUrl,
} from "../support/db";
import { db } from "@/src/lib/db";
import * as schema from "@/src/lib/db/schema";
import {
  createTask,
  deleteTask,
  getTask,
  rollOverIvyLee,
  TaskRuleError,
  updateTask,
} from "@/src/features/tasks/server";
import {
  initPreferences,
  getPreferences,
  updatePreferences,
} from "@/src/features/preferences/server";

const A = "dm-user-a";
const B = "dm-user-b";

beforeAll(async () => {
  if (!(await setupTestDatabase())) return;
  await createTestUsers(A, B);
});
afterAll(async () => {
  if (testDatabaseUrl) await deleteTestUsers(A, B);
  vi.unstubAllEnvs();
});

async function seedEverything(userId: string) {
  const id = (p: string) => `${p}-${userId}`;
  await db()
    .insert(schema.userPreferences)
    .values({ userId })
    .onConflictDoNothing();
  await db()
    .insert(schema.project)
    .values({ id: id("p"), userId, name: "Project" });
  await db()
    .insert(schema.task)
    .values({ id: id("t"), userId, title: "Task", projectId: id("p") });
  const now = new Date();
  await db()
    .insert(schema.focusSession)
    .values({
      id: id("s"),
      userId,
      mode: "learning",
      timeTechnique: "pomodoro",
      taskId: id("t"),
      startedAt: now,
      endedAt: now,
      focusedSeconds: 1500,
      completed: true,
    });
  await db()
    .insert(schema.learningDraft)
    .values({
      id: id("d"),
      userId,
      sessionId: id("s"),
      topic: "Topic",
      learningMethod: "feynman",
    });
  await db()
    .insert(schema.learningItem)
    .values({
      id: id("c"),
      userId,
      sessionId: id("s"),
      topic: "Topic",
      learningMethod: "feynman",
      explanation: "An explanation",
      intervalDays: 5,
      dueOn: "2026-11-07",
    });
  await db()
    .update(schema.focusSession)
    .set({ learningItemId: id("c") })
    .where(eq(schema.focusSession.id, id("s")));
  await db()
    .insert(schema.question)
    .values({
      id: id("q"),
      learningItemId: id("c"),
      type: "open",
      prompt: "Why?",
      answer: "Because",
    });
  await db()
    .insert(schema.review)
    .values({
      id: id("r"),
      learningItemId: id("c"),
      userId,
      scheduledOn: "2026-11-07",
      scorePct: 100,
      passed: true,
      stepBefore: 0,
      stepAfter: 1,
      nextDueOn: "2026-11-12",
    });
  await db()
    .insert(schema.reviewAnswer)
    .values({
      id: id("ra"),
      reviewId: id("r"),
      questionId: id("q"),
      answer: "Because",
      verdict: "correct",
      gradedBy: "self",
    });
  await db()
    .insert(schema.aiUsage)
    .values({ userId, period: "2026-11", cardsAnalyzed: 1 });
  await db()
    .insert(schema.notificationLog)
    .values({
      id: id("n"),
      userId,
      kind: "review_digest",
      channel: "email",
      periodKey: "2026-11-07",
    });
  await db()
    .insert(schema.pushSubscription)
    .values({
      id: id("ps"),
      userId,
      endpoint: `https://push.example.test/${userId}`,
      p256dh: "k",
      auth: "a",
    });
}

const ownedTables = [
  schema.userPreferences,
  schema.project,
  schema.task,
  schema.focusSession,
  schema.learningDraft,
  schema.learningItem,
  schema.review,
  schema.aiUsage,
  schema.notificationLog,
  schema.pushSubscription,
] as const;

describe.skipIf(!testDatabaseUrl)("data model", () => {
  it("cascades account deletion through every product table", async () => {
    const victim = "dm-delete-me";
    await createTestUsers(victim);
    await seedEverything(victim);
    for (const table of ownedTables) {
      const rows = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(table)
        .where(eq(table.userId, victim));
      expect(rows[0].n, getTableName(table)).toBeGreaterThan(0);
    }
    await deleteTestUsers(victim);
    for (const table of ownedTables) {
      const rows = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(table)
        .where(eq(table.userId, victim));
      expect(rows[0].n).toBe(0);
    }
    const orphans = await db().execute(sql`
      select (select count(*) from question where learning_item_id = ${"c-" + victim})
           + (select count(*) from review_answer where review_id = ${"r-" + victim}) as n`);
    expect(Number(orphans.rows[0].n)).toBe(0);
  });

  it("never lets one user read, change or delete another user's task", async () => {
    const mine = await createTask(A, { title: "A's task" });
    expect(await getTask(B, mine.id)).toBeUndefined();
    expect(await updateTask(B, mine.id, { title: "hijacked" })).toBeUndefined();
    expect(await deleteTask(B, mine.id)).toBe(false);
    expect((await getTask(A, mine.id))?.title).toBe("A's task");
  });

  it("rejects linking a task to another user's project", async () => {
    await db()
      .insert(schema.project)
      .values({ id: "dm-b-project", userId: B, name: "B" })
      .onConflictDoNothing();
    await expect(
      createTask(A, { title: "x", projectId: "dm-b-project" }),
    ).rejects.toBeInstanceOf(TaskRuleError);
  });

  it("is idempotent for client-generated ids", async () => {
    const clientId = crypto.randomUUID();
    const first = await createTask(A, { title: "Imported", clientId });
    const second = await createTask(A, { title: "Imported", clientId });
    expect(second.id).toBe(first.id);
  });

  it("enforces the 1-3-5 slots and a single frog per day", async () => {
    const day = "2030-01-15";
    await createTask(A, { title: "big", size135: "big", plannedFor: day });
    await expect(
      createTask(A, { title: "big 2", size135: "big", plannedFor: day }),
    ).rejects.toThrow("slot_full");
    const f1 = await createTask(A, { title: "frog 1" });
    const f2 = await createTask(A, { title: "frog 2" });
    await updateTask(A, f1.id, { isFrogOn: day });
    await updateTask(A, f2.id, { isFrogOn: day });
    expect((await getTask(A, f1.id))?.isFrogOn).toBeNull();
    expect((await getTask(A, f2.id))?.isFrogOn).toBe(day);
  });

  it("rolls unfinished Ivy Lee tasks into today in order", async () => {
    const yesterday = "2031-03-09";
    const today = "2031-03-10";
    const first = await createTask(A, {
      title: "ivy 1",
      plannedFor: yesterday,
      ivyRank: 1,
    });
    const done = await createTask(A, {
      title: "ivy 2",
      plannedFor: yesterday,
      ivyRank: 2,
    });
    const third = await createTask(A, {
      title: "ivy 3",
      plannedFor: yesterday,
      ivyRank: 3,
    });
    await updateTask(A, done.id, { status: "done" });
    const fresh = await createTask(A, {
      title: "new",
      plannedFor: today,
      ivyRank: 1,
    });
    expect(await rollOverIvyLee(A, today)).toBe(2);
    expect(await rollOverIvyLee(A, today)).toBe(0);
    expect((await getTask(A, first.id))?.ivyRank).toBe(1);
    expect((await getTask(A, third.id))?.ivyRank).toBe(2);
    expect((await getTask(A, fresh.id))?.ivyRank).toBe(3);
    expect((await getTask(A, done.id))?.plannedFor).toBe(yesterday);
  });

  it("stores first-visit preferences once and validates review steps in the database", async () => {
    await initPreferences(B, { timezone: "Asia/Baku", locale: "az" });
    await initPreferences(B, { timezone: "Europe/Paris", locale: "fr" });
    const prefs = await getPreferences(B);
    expect(prefs.timezone).toBe("Asia/Baku");
    expect(prefs.locale).toBe("az");
    await expect(
      db()
        .update(schema.userPreferences)
        .set({ reviewSteps: [10, 5, 30] })
        .where(eq(schema.userPreferences.userId, B)),
    ).rejects.toThrow();
    expect(
      (await updatePreferences(B, { reviewSteps: [3, 7, 21] })).reviewSteps,
    ).toEqual([3, 7, 21]);
  });
});
