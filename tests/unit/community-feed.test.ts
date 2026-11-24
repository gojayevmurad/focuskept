// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const mocks = vi.hoisted(() => ({ db: vi.fn(), reportUser: vi.fn() }));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("@/src/lib/safety", () => ({ reportUser: mocks.reportUser }));
import {
  cheerPost,
  communityFeed,
  createPost,
  deletePost,
  reportPost,
  setAutomaticWins,
} from "@/src/lib/community/feed";
import { feedCursor, postInput } from "@/src/lib/community/validation";
import {
  communityPost,
  communityReaction,
  profile,
  report,
} from "@/src/lib/db/schema";

const id = "00000000-0000-4000-8000-000000000001";
const groupId = "00000000-0000-4000-8000-000000000002";
const input = {
  body: "  Writing my thesis  ",
  kind: "working",
  groupId: "",
  sessionId: "",
};
const dialect = new PgDialect();
const compile = (s: SQL) => dialect.sqlToQuery(s);
function fixture(selections: unknown[][] = []) {
  const conditions: SQL[] = [];
  const limit = vi.fn();
  const orderBy = vi.fn();
  function chain(rows: unknown[]) {
    const result = {
      from: vi.fn(() => result),
      innerJoin: vi.fn(() => result),
      where: vi.fn((condition: SQL) => {
        conditions.push(condition);
        return result;
      }),
      orderBy: vi.fn((...args: unknown[]) => {
        orderBy(...args);
        return result;
      }),
      limit: vi.fn((n: number) => {
        limit(n);
        return result;
      }),
      returning: vi.fn(() => Promise.resolve(rows)),
      onConflictDoNothing: vi.fn(() => Promise.resolve()),
      then: (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    };
    return result;
  }
  const insertChain = chain([]);
  const values = vi.fn(() => insertChain);
  const set = vi.fn(() => chain([{ id }]));
  const database = {
    select: vi.fn(() => chain(selections.shift() ?? [])),
    execute: vi.fn(async (_query: SQL) => ({ rows: [] })),
    insert: vi.fn(() => ({ values })),
    update: vi.fn(() => ({ set })),
    delete: vi.fn(() => chain([])),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(database)),
  };
  mocks.db.mockReturnValue(database);
  return { database, values, set, conditions, insertChain, limit, orderBy };
}
beforeEach(() => vi.resetAllMocks());
describe("community posting", () => {
  it("validates length, trims whitespace, and rejects invalid session IDs", () => {
    expect(postInput.parse(input).body).toBe("Writing my thesis");
    for (const body of [" ", "a".repeat(281)])
      expect(postInput.safeParse({ ...input, body }).success).toBe(false);
    expect(
      postInput.safeParse({ ...input, body: "a".repeat(280) }).success,
    ).toBe(true);
    expect(
      postInput.safeParse({ ...input, sessionId: "not-a-session" }).success,
    ).toBe(false);
  });
  it("takes a per-person transaction lock and counts the last hour, including deleted posts", async () => {
    const f = fixture([[{ n: 10 }]]);
    expect(
      await createPost("writer", input, new Date("2026-11-24T12:00:00Z")),
    ).toEqual({ error: "rateLimit" });
    const lock = compile(f.database.execute.mock.calls[0][0]);
    expect(lock.sql).toContain("pg_advisory_xact_lock");
    expect(lock.params).toContain("community-post:writer");
    expect(compile(f.conditions[0]).params).toEqual([
      "writer",
      "2026-11-24T11:00:00.000Z",
    ]);
    expect(compile(f.conditions[0]).sql).not.toContain("deleted_at");
    expect(f.database.insert).not.toHaveBeenCalled();
  });
  it("posts under the limit and never accepts a supplied author", async () => {
    const f = fixture([[{ n: 9 }]]);
    expect(
      await createPost("writer", { ...input, userId: "someone-else" }),
    ).toEqual({ ok: true });
    expect(f.database.insert).toHaveBeenCalledWith(communityPost);
    expect(f.values).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Writing my thesis",
        userId: "writer",
        groupId: null,
        sessionId: null,
      }),
    );
  });
  it("checks circle membership and session participation before inserting", async () => {
    let f = fixture([[{ n: 0 }], []]);
    expect(await createPost("writer", { ...input, groupId })).toEqual({
      error: "membership",
    });
    expect(f.values).not.toHaveBeenCalled();
    f = fixture([[{ n: 0 }], []]);
    expect(await createPost("writer", { ...input, sessionId: id })).toEqual({
      error: "session",
    });
    expect(f.values).not.toHaveBeenCalled();
    f = fixture([[{ n: 0 }], [{}], [{}]]);
    expect(
      await createPost("writer", { ...input, groupId, sessionId: id }),
    ).toEqual({ ok: true });
    expect(f.values).toHaveBeenCalled();
  });
  it("soft-deletes only a live post owned by the current person", async () => {
    const f = fixture();
    await deletePost("writer", id);
    expect(f.set).toHaveBeenCalledWith({ deletedAt: expect.any(Date) });
    const where = compile(f.conditions[0]);
    expect(where.params).toEqual([id, "writer"]);
    expect(where.sql).toContain('"community_post"."deleted_at" is null');
  });
  it("saves an explicit automatic-sharing preference", async () => {
    const f = fixture();
    await setAutomaticWins("writer", false);
    expect(f.database.update).toHaveBeenCalledWith(profile);
    expect(f.set).toHaveBeenCalledWith({ shareWinsAutomatically: false });
    expect(compile(f.conditions[0]).params).toEqual(["writer"]);
  });
});
describe("cheers and safety", () => {
  it("upserts one cheer per person and removes only that person's cheer", async () => {
    let f = fixture([[{ id, userId: "author" }]]);
    expect(await cheerPost("reader", id, true)).toBe(true);
    expect(f.database.insert).toHaveBeenCalledWith(communityReaction);
    expect(f.values).toHaveBeenCalledWith({ postId: id, userId: "reader" });
    expect(f.insertChain.onConflictDoNothing).toHaveBeenCalled();
    f = fixture([[{ id, userId: "author" }]]);
    expect(await cheerPost("reader", id, false)).toBe(true);
    expect(compile(f.conditions.at(-1)!).params).toEqual([id, "reader"]);
  });
  it("refuses reactions and reports on deleted, suspended or blocked posts", async () => {
    const f = fixture([[], []]);
    expect(await cheerPost("reader", id, true)).toBe(false);
    expect(
      await reportPost("reader", { postId: id, reason: "spam", details: "" }),
    ).toBe(false);
    const where = compile(f.conditions[0]);
    expect(where.sql).toContain('"community_post"."deleted_at" is null');
    expect(where.sql).toContain('"profile"."suspended_at" is null');
    expect(where.sql).toContain("blocker_id");
    expect(where.sql).toContain("blocked_id");
    expect(f.values).not.toHaveBeenCalled();
    expect(mocks.reportUser).not.toHaveBeenCalled();
  });
  it("reuses reporting/blocking and preserves a post snapshot and moderation reference", async () => {
    const f = fixture([[{ id, userId: "author", body: "Spam evidence" }]]);
    mocks.reportUser.mockResolvedValue("report-id");
    expect(
      await reportPost("reader", {
        postId: id,
        reason: "spam",
        details: "Repeated links",
      }),
    ).toBe(true);
    expect(mocks.reportUser).toHaveBeenCalledWith({
      reporterId: "reader",
      targetId: "author",
      reason: "spam",
      details: `[Community post ${id}]\nSpam evidence\n\nRepeated links`,
    });
    expect(f.database.update).toHaveBeenCalledWith(report);
    expect(f.set).toHaveBeenCalledWith({ postId: id });
  });
  it("does not report your own post", async () => {
    fixture([[{ id, userId: "reader", body: "Mine" }]]);
    expect(
      await reportPost("reader", { postId: id, reason: "spam", details: "" }),
    ).toBe(false);
    expect(mocks.reportUser).not.toHaveBeenCalled();
  });
});
describe("feed pagination and circle filtering", () => {
  it("filters by circle membership, not just where a post was composed", async () => {
    const f = fixture([[]]);
    await communityFeed("reader", groupId);
    const where = compile(f.conditions[0]);
    expect(where.sql).toContain('m.user_id = "community_post"."user_id"');
    expect(where.params).toContain(groupId);
    expect(where.sql).not.toContain('"community_post"."group_id" =');
    expect(f.limit).toHaveBeenCalledWith(21);
    expect(f.orderBy).toHaveBeenCalled();
  });
  it("uses timestamp plus ID for stable newest-first pagination", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      createdAt: new Date("2026-11-24T12:00:00Z"),
    }));
    fixture([rows]);
    const result = await communityFeed("reader");
    expect(result.posts).toHaveLength(20);
    expect(feedCursor(result.next!)).toEqual({
      at: rows[19].createdAt.toISOString(),
      id: rows[19].id,
    });
    const f = fixture([[]]);
    await communityFeed("reader", undefined, result.next!);
    expect(compile(f.conditions[0]).sql).toContain(
      '("community_post"."created_at", "community_post"."id") <',
    );
    expect(feedCursor("garbage")).toBeNull();
  });
});
