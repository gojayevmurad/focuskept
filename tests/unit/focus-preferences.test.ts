// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ where: vi.fn() }));
vi.mock("@/src/lib/db", () => ({
  db: () => ({ select: () => ({ from: () => ({ where: mocks.where }) }) }),
}));
import { getFocusPreferences } from "@/src/lib/profiles/focus-preferences";
beforeEach(() => {
  vi.resetAllMocks();
});
it("returns saved booking preferences and counts completed sessions in the local week", async () => {
  mocks.where
    .mockResolvedValueOnce([
      {
        timezone: "Asia/Baku",
        focusAreas: ["writing", "unknown"],
        blockers: ["starting"],
        preferredTimes: ["morning"],
        defaultDuration: 25,
        weeklyGoal: 3,
        sessionStyle: "quiet",
        microphoneDefault: false,
      },
    ])
    .mockResolvedValueOnce([{ count: 2 }]);
  const preferences = await getFocusPreferences(
    "member",
    new Date("2026-11-24T12:00:00Z"),
  );
  expect(preferences).toMatchObject({
    focusAreas: ["writing"],
    defaultDuration: 25,
    weeklyGoal: 3,
    completedThisWeek: 2,
    preferredTimes: ["morning"],
  });
  const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[1][0]);
  expect(query.params).toEqual([
    "member",
    "completed",
    "2026-11-22T20:00:00.000Z",
    "2026-11-29T20:00:00.000Z",
  ]);
});
it("handles missing profiles without a second query", async () => {
  mocks.where.mockResolvedValueOnce([]);
  expect(await getFocusPreferences("missing")).toBeNull();
  expect(mocks.where).toHaveBeenCalledTimes(1);
});
