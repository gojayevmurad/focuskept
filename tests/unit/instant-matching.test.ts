// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const mocks = vi.hoisted(() => ({ db: vi.fn(), canBookAnother: vi.fn(), publish: vi.fn(), alert: vi.fn(), warn: vi.fn() }));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("@/src/lib/billing/plan", () => ({ canBookAnother: mocks.canBookAnother }));
vi.mock("@/src/lib/realtime/publish", () => ({ publish: mocks.publish }));
vi.mock("@/src/lib/admin/alerts", () => ({ sendAdminAlert: mocks.alert }));
vi.mock("@/src/lib/logger", () => ({ logger: { warn: mocks.warn } }));
import { booking, focusSession, matchRequest, profile, sessionParticipant } from "@/src/lib/db/schema";
import { cancelInstantMatch, expireMatchRequests, getInstantMatch, joinInstantMatch, MATCH_WAIT_MS, startInstantMatch } from "@/src/lib/matching/instant";

const now = new Date("2026-11-24T10:04:37Z");
const person = { userId: "a", displayName: "Alex", timezone: "Europe/Berlin", onboardedAt: now, suspendedAt: null };
const waiting = { id: "request-b", userId: "b", durationMin: 25, status: "waiting", sessionId: null, createdAt: now, matchedAt: null };
let selections: unknown[][];
let writes: { table: unknown; values: unknown }[];
let conditions: { table: unknown; sql: string; params: unknown[] }[];
let statements: string[];
let committed: boolean;
let expired: { id: string }[];
beforeEach(() => {
  vi.resetAllMocks(); selections = []; writes = []; conditions = []; statements = []; expired = []; committed = false;
  const tx = {
    execute: async (statement: SQL) => { statements.push(new PgDialect().sqlToQuery(statement).sql); },
    select: () => {
      const rows = selections.shift();
      if (!rows) throw new Error("Unexpected select");
      let table: unknown;
      const query = {
        from: (value: unknown) => { table = value; return query; },
        innerJoin: () => query,
        where: (condition: SQL) => { conditions.push({ table, ...new PgDialect().sqlToQuery(condition) }); return query; },
        orderBy: () => query, limit: () => query, for: () => query,
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
      };
      return query;
    },
    insert: (table: unknown) => ({ values: async (values: unknown) => { writes.push({ table, values }); } }),
    update: (table: unknown) => ({ set: (values: unknown) => {
      writes.push({ table, values });
      return { where: () => ({ then: (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve), returning: async () => expired }) };
    } }),
  };
  mocks.db.mockReturnValue({ transaction: async (fn: (value: typeof tx) => unknown) => { const result = await fn(tx); committed = true; return result; } });
  mocks.canBookAnother.mockResolvedValue({ ok: true });
  mocks.publish.mockImplementation(async () => { expect(committed).toBe(true); });
  mocks.alert.mockImplementation(async () => { expect(committed).toBe(true); });
});
function queueNew(candidates: unknown[] = []) {
  selections.push([], [], [person], [], [], candidates);
}

describe("instant matching transactions", () => {
  it("pairs compatible waiting requests, rounds the clock down, records bookings and publishes after commit", async () => {
    queueNew([waiting]); selections.push([{ ...person, userId: "b" }], []);
    const result = await startInstantMatch("a", 25, now);
    expect(result).toMatchObject({ status: "matched", matchedAt: now });
    expect(writes.find((w) => w.table === focusSession)?.values).toMatchObject({ type: "pair", capacity: 2, durationMin: 25, startAt: new Date("2026-11-24T10:04:00Z") });
    expect(writes.find((w) => w.table === booking)?.values).toEqual(expect.arrayContaining([expect.objectContaining({ userId: "a", status: "matched" }), expect.objectContaining({ userId: "b", status: "matched" })]));
    expect(writes.find((w) => w.table === sessionParticipant)?.values).toHaveLength(2);
    expect(mocks.publish).toHaveBeenCalledWith("user:a", "match.found", { sessionId: result.sessionId });
    expect(mocks.publish).toHaveBeenCalledWith("user:b", "match.found", { sessionId: result.sessionId });
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(statements[0]).toContain("pg_advisory_xact_lock");
  });
  it("keeps one waiting request and immediately alerts admins after commit", async () => {
    queueNew();
    const result = await startInstantMatch("a", 50, now);
    expect(result.status).toBe("waiting");
    expect(mocks.alert).toHaveBeenCalledExactlyOnceWith("match_now_waiting", result.id, { name: "Alex", durationMin: 50, path: `/match-now/join/${result.id}` });
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it.each([25, 50])("filters self, expiry and mismatched duration in the queue query for %i minutes", async (duration) => {
    queueNew(); await startInstantMatch("a", duration, now);
    const query = conditions.filter((c) => c.table === matchRequest).at(-1)!;
    expect(query.sql).toContain('"user_id" <>');
    expect(query.sql).toContain('"duration_min" =');
    expect(query.sql).toContain('"created_at" >');
    expect(query.params).toEqual(["waiting", duration, "a", new Date(now.getTime() - MATCH_WAIT_MS).toISOString()]);
  });
  it.each(["blocker", "blocked"])("does not match when the user is the %s", async (direction) => {
    selections.push([], [], [person], [], [{ blockerId: direction === "blocker" ? "a" : "b", blockedId: direction === "blocker" ? "b" : "a" }], [waiting]);
    const result = await startInstantMatch("a", 25, now);
    expect(result.status).toBe("waiting");
    expect(writes.some((w) => w.table === focusSession)).toBe(false);
  });
  it("returns the existing waiting request on repeated clicks, even with a different duration", async () => {
    const own = { ...waiting, userId: "a" };
    selections.push([own], [person]);
    expect(await startInstantMatch("a", 50, now)).toEqual(own);
    expect(writes.filter((w) => w.table === matchRequest)).toHaveLength(1); // expiry only
    expect(mocks.alert).not.toHaveBeenCalled();
  });
  it("returns a still-running match instead of creating another request", async () => {
    const own = { ...waiting, userId: "a", status: "matched", sessionId: "session" };
    selections.push([], [{ request: own }], [person]);
    expect(await startInstantMatch("a", 25, now)).toEqual(own);
    expect(writes.some((w) => w.table === focusSession)).toBe(false);
  });
  it("rejects unsupported durations before writing", async () => {
    await expect(startInstantMatch("a", 75, now)).rejects.toMatchObject({ code: "duration" });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each(["suspended", "limit", "overlap"])("enforces %s before creating a request", async (code) => {
    selections.push([], [], [{ ...person, suspendedAt: code === "suspended" ? now : null }]);
    if (code === "limit") mocks.canBookAnother.mockResolvedValue({ ok: false });
    if (code === "overlap") selections.push([{ id: "existing-booking" }]);
    await expect(startInstantMatch("a", 25, now)).rejects.toMatchObject({ code });
    expect(writes.some((w) => w.table === focusSession)).toBe(false);
    expect(mocks.alert).not.toHaveBeenCalled();
  });
  it("skips and cancels a waiting account that has since become suspended", async () => {
    queueNew([waiting]); selections.push([{ ...person, userId: "b", suspendedAt: now }]);
    expect((await startInstantMatch("a", 25, now)).status).toBe("waiting");
    expect(writes).toContainEqual({ table: matchRequest, values: { status: "cancelled" } });
  });
  it("expires waiting requests at ten minutes on the worker path", async () => {
    expired = [{ id: "old" }];
    expect(await expireMatchRequests(now)).toBe(1);
    expect(writes).toContainEqual({ table: matchRequest, values: { status: "expired" } });
  });
  it("lets an admin claim a specific waiting request through the same eligibility checks", async () => {
    selections.push([waiting], [], [], [person], [], [], [{ ...person, userId: "b" }], []);
    expect((await joinInstantMatch("a", waiting.id, now)).status).toBe("matched");
  });
  it("refuses self-joining and unavailable admin links", async () => {
    selections.push([{ ...waiting, userId: "a" }]);
    await expect(joinInstantMatch("a", waiting.id, now)).rejects.toMatchObject({ code: "self" });
    selections.push([{ ...waiting, status: "expired" }], [], []);
    await expect(joinInstantMatch("a", waiting.id, now)).rejects.toMatchObject({ code: "unavailable" });
  });
  it("does not redirect an ended match from GET, but returns an expired search", async () => {
    selections.push([], [], [{ ...waiting, status: "matched", sessionId: "ended" }]);
    expect(await getInstantMatch("a", now)).toBeNull();
    selections.push([], [], [{ ...waiting, status: "expired" }]);
    expect((await getInstantMatch("a", now))?.status).toBe("expired");
  });
  it("cancels only waiting requests and returns a match if matching won the race", async () => {
    const own = { ...waiting, status: "matched", sessionId: "session" };
    selections.push([], [{ request: own }]);
    expect(await cancelInstantMatch("a", now)).toEqual(own);
    expect(writes).toContainEqual({ table: matchRequest, values: { status: "cancelled" } });
  });
  it("logs realtime failures without losing the committed match", async () => {
    queueNew([waiting]); selections.push([{ ...person, userId: "b" }], []);
    mocks.publish.mockRejectedValue(new Error("offline"));
    expect((await startInstantMatch("a", 25, now)).status).toBe("matched");
    expect(mocks.warn).toHaveBeenCalledTimes(2);
  });
});
