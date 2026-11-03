import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createTestUsers,
  deleteTestUsers,
  setupTestDatabase,
  testDatabaseUrl,
} from "../support/db";
import { db } from "@/src/lib/db";
import { focusSession, task } from "@/src/lib/db/schema";
import {
  dailyFocus,
  focusByHour,
  focusByTag,
  focusSummary,
  techniqueRanking,
} from "@/src/features/stats/server";
import { exportAll } from "@/src/features/export/server";

const A = "st-user-a";
const B = "st-user-b";
beforeAll(async () => {
  if (!(await setupTestDatabase())) return;
  await createTestUsers(A, B);
  const taskId = crypto.randomUUID();
  await db()
    .insert(task)
    .values({ id: taskId, userId: A, title: "Code", tags: ["coding"] });
  const base = Date.parse("2026-11-02T09:00:00Z");
  await db()
    .insert(focusSession)
    .values([
      {
        id: crypto.randomUUID(),
        userId: A,
        mode: "work",
        timeTechnique: "52-17",
        taskId,
        startedAt: new Date(base),
        endedAt: new Date(base + 3_120_000),
        focusedSeconds: 3120,
        focusRating: 5,
        completed: true,
      },
      {
        id: crypto.randomUUID(),
        userId: A,
        mode: "work",
        timeTechnique: "pomodoro",
        startedAt: new Date(base + 86_400_000),
        endedAt: new Date(base + 86_400_000 + 1_500_000),
        focusedSeconds: 1500,
        focusRating: 3,
        completed: true,
      },
      {
        id: crypto.randomUUID(),
        userId: B,
        mode: "work",
        timeTechnique: "flowtime",
        startedAt: new Date(base),
        endedAt: new Date(base + 600_000),
        focusedSeconds: 600,
        completed: true,
      },
    ]);
});
afterAll(async () => {
  if (testDatabaseUrl) await deleteTestUsers(A, B);
  vi.unstubAllEnvs();
});

describe.skipIf(!testDatabaseUrl)("stats and export", () => {
  const range = { timezone: "Asia/Baku", from: "2026-11-01", to: "2026-11-07" };
  it("aggregates only the user's own sessions by local day, technique, hour and tag", async () => {
    expect(await focusSummary(A, range)).toMatchObject({
      seconds: 4620,
      sessions: 2,
      rated: 2,
    });
    const days = await dailyFocus(A, range);
    expect(days).toHaveLength(7);
    expect(days.find((d) => d.day === "2026-11-02")?.minutes).toBe(52);
    expect((await techniqueRanking(A, range))[0].technique).toBe("52-17");
    expect(
      (await focusByHour(A, "Asia/Baku", null)).map((h) => h.hour),
    ).toEqual([13]);
    expect(await focusByTag(A)).toEqual([
      expect.objectContaining({ tag: "coding", technique: "52-17" }),
    ]);
  });
  it("exports only the requesting user's data", async () => {
    const data = await exportAll(A);
    expect(data.profile.id).toBe(A);
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions.every((s) => s.userId === A)).toBe(true);
    expect(data.tasks).toHaveLength(1);
  });
});
