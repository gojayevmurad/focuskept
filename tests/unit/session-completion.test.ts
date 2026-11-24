// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  publish: vi.fn(),
  track: vi.fn(),
  convert: vi.fn(),
}));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("@/src/lib/realtime/publish", () => ({ publish: mocks.publish }));
vi.mock("@/src/lib/analytics/product", () => ({ trackForUser: mocks.track }));
vi.mock("@/src/lib/growth/referrals", () => ({
  convertReferral: mocks.convert,
}));
import { booking, focusSession } from "@/src/lib/db/schema";
import {
  completeEndedSessions,
  endAbandonedSessions,
} from "@/src/lib/sessions/lifecycle";

const now = new Date("2027-01-01T10:00:00Z");
const dialect = new PgDialect();
let conditions: { sql: string; params: unknown[] }[];
let updates: { table: unknown; values: unknown }[];
let ended: { id: string; hostId: string | null }[];
beforeEach(() => {
  vi.resetAllMocks();
  conditions = [];
  updates = [];
  ended = [{ id: "session", hostId: null }];
  mocks.publish.mockResolvedValue(undefined);
  mocks.convert.mockResolvedValue(undefined);
  mocks.db.mockReturnValue({
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: (condition: SQL) => {
          updates.push({ table, values });
          if (table === focusSession)
            conditions.push(dialect.sqlToQuery(condition));
          return Object.assign(Promise.resolve(undefined), {
            returning: async () => ended,
          });
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: async () => [
          { bookingId: "attended", userId: "a", joinedAt: now },
          { bookingId: "missed", userId: "b", joinedAt: null },
        ],
      }),
    }),
  });
});
describe("abandoned session completion", () => {
  it("uses an inclusive five-minute cutoff against the latest departure", async () => {
    await endAbandonedSessions(now);
    expect(conditions[0].sql).toMatch(/select max\(p.left_at\)[\s\S]*<=/);
    expect(conditions[0].params).toContainEqual(
      new Date(now.getTime() - 5 * 60_000),
    );
    expect(conditions[0].params).toEqual(
      expect.arrayContaining(["scheduled", "live"]),
    );
  });
  it("excludes anyone still present and requires a participant to have joined", async () => {
    ended = [];
    expect(await endAbandonedSessions(now)).toEqual({
      ended: 0,
      completedUsers: 0,
    });
    expect(conditions[0].sql).toMatch(
      /exists \([\s\S]*p.joined_at is not null/,
    );
    expect(conditions[0].sql).toMatch(
      /not exists \([\s\S]*p.joined_at is null\s*\)/,
    );
    expect(conditions[0].sql).toMatch(
      /not exists \([\s\S]*p.joined_at is not null and p.left_at is null/,
    );
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it.each([completeEndedSessions, endAbandonedSessions])(
    "settles attendance and publishes the same end event (%s)",
    async (complete) => {
      expect(await complete(now)).toEqual({ ended: 1, completedUsers: 1 });
      expect(updates).toEqual(
        expect.arrayContaining([
          { table: focusSession, values: { status: "ended", endedAt: now } },
          { table: booking, values: { status: "completed" } },
          { table: booking, values: { status: "no_show" } },
        ]),
      );
      expect(mocks.publish).toHaveBeenCalledExactlyOnceWith(
        "session:session",
        "session.ended",
        {},
      );
      expect(mocks.track).toHaveBeenCalledExactlyOnceWith(
        "a",
        "session_completed",
      );
      expect(mocks.convert).toHaveBeenCalledExactlyOnceWith("a");
    },
  );
});
