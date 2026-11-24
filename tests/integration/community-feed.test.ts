// SPDX-License-Identifier: AGPL-3.0-only
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/src/lib/db/schema";
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
import {
  cheerPost,
  communityFeed,
  createPost,
  deletePost,
  reportPost,
  setAutomaticWins,
} from "@/src/lib/community/feed";
import { overviewMetrics } from "@/src/lib/admin/metrics";
const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL must end in _test");
const pool = new Pool({ connectionString: url });
const database = drizzle(pool, { schema });
const writer = `community-writer-${randomUUID()}`;
const reader = `community-reader-${randomUUID()}`;
const now = new Date();
const circle = randomUUID();
const sessions: string[] = [];
let sequence = 0;
beforeAll(async () => {
  if (!url) return;
  mocks.db.mockReturnValue(database);
  await migrate(database, { migrationsFolder: "./drizzle" });
  for (const id of [writer, reader]) {
    await database
      .insert(schema.user)
      .values({
        id,
        name: id,
        email: `${id}@example.test`,
        emailVerified: true,
      });
    await database
      .insert(schema.profile)
      .values({
        userId: id,
        displayName: "Writer",
        username: id,
        referralCode: randomUUID(),
      });
  }
  await database
    .insert(schema.community)
    .values({
      id: circle,
      name: "Writers",
      slug: circle,
      ownerId: writer,
      joinCode: randomUUID(),
    });
  await database
    .insert(schema.communityMember)
    .values({ communityId: circle, userId: writer });
});
afterAll(async () => {
  if (url) {
    await database
      .delete(schema.community)
      .where(eq(schema.community.id, circle));
    for (const id of sessions)
      await database
        .delete(schema.focusSession)
        .where(eq(schema.focusSession.id, id));
    for (const id of [writer, reader])
      await database.delete(schema.user).where(eq(schema.user.id, id));
  }
  await pool.end();
});
async function seat(attended = true) {
  const id = randomUUID();
  sessions.push(id);
  const bookingId = randomUUID();
  await database
    .insert(schema.focusSession)
    .values({
      id,
      startAt: new Date(now.getTime() - ++sequence * 1800000),
      durationMin: 25,
      status: "ended",
    });
  await database
    .insert(schema.booking)
    .values({
      id: bookingId,
      userId: writer,
      sessionId: id,
      startAt: new Date(now.getTime() - sequence * 1800000),
      durationMin: 25,
      status: "matched",
    });
  await database
    .insert(schema.sessionParticipant)
    .values({
      sessionId: id,
      userId: writer,
      bookingId,
      goalText: "Finish my draft",
      joinedAt: attended ? now : null,
    });
  return { id, bookingId };
}
const outcome = (id: string, value: string) =>
  database
    .update(schema.sessionParticipant)
    .set({ outcome: value })
    .where(
      and(
        eq(schema.sessionParticipant.sessionId, id),
        eq(schema.sessionParticipant.userId, writer),
      ),
    );
const complete = (bookingId: string) =>
  database
    .update(schema.booking)
    .set({ status: "completed" })
    .where(eq(schema.booking.id, bookingId));
const autoPosts = () =>
  database
    .select()
    .from(schema.communityPost)
    .where(
      and(
        eq(schema.communityPost.userId, writer),
        eq(schema.communityPost.automatic, true),
      ),
    );
describe.skipIf(!url)(
  "community migration and real PostgreSQL behavior",
  () => {
    it("keeps automatic sharing off by default", async () => {
      const [person] = await database
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, writer));
      expect(person.shareWinsAutomatically).toBe(false);
      const s = await seat();
      await outcome(s.id, "done");
      await complete(s.bookingId);
      expect(await autoPosts()).toHaveLength(0);
    });
    it("shares exactly once whether outcome arrives before or after completion, and never republishes deleted wins", async () => {
      await setAutomaticWins(writer, true);
      const first = await seat();
      await outcome(first.id, "done");
      expect(await autoPosts()).toHaveLength(0);
      await complete(first.bookingId);
      const second = await seat();
      await complete(second.bookingId);
      await outcome(second.id, "done");
      const posts = await autoPosts();
      expect(posts).toHaveLength(2);
      expect(
        posts.every((p) => p.body === "Finish my draft" && p.kind === "done"),
      ).toBe(true);
      await deletePost(writer, posts[0].id);
      await outcome(first.id, "partial");
      await outcome(first.id, "done");
      expect(await autoPosts()).toHaveLength(2);
    });
    it("requires actual attendance and respects opting back out", async () => {
      const absent = await seat(false);
      await outcome(absent.id, "done");
      await complete(absent.bookingId);
      await setAutomaticWins(writer, false);
      const optedOut = await seat();
      await outcome(optedOut.id, "done");
      await complete(optedOut.bookingId);
      expect(await autoPosts()).toHaveLength(2);
    });
    it("limits concurrent manual posts to 10 per hour including deleted posts and automatic wins", async () => {
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          createPost(writer, {
            body: "Writing",
            kind: "working",
            sessionId: "",
            groupId: "",
          }),
        ),
      );
      expect(results.filter((r) => "ok" in r)).toHaveLength(8);
      expect(
        results.filter((r) => "error" in r && r.error === "rateLimit"),
      ).toHaveLength(4);
    });
    it("filters circles by their members and upserts/deletes cheers and own posts", async () => {
      const result = await communityFeed(reader, circle);
      expect(result.posts).toHaveLength(9);
      const post = result.posts[0];
      expect(post.userId).toBe(writer);
      await Promise.all([
        cheerPost(reader, post.id, true),
        cheerPost(reader, post.id, true),
      ]);
      expect(
        (await communityFeed(reader, circle)).posts.find(
          (p) => p.id === post.id,
        )?.cheers,
      ).toBe(1);
      await cheerPost(reader, post.id, false);
      expect(
        (await communityFeed(reader, circle)).posts.find(
          (p) => p.id === post.id,
        )?.cheers,
      ).toBe(0);
      expect(await deletePost(reader, post.id)).toHaveLength(0);
      expect(await deletePost(writer, post.id)).toHaveLength(1);
      expect((await communityFeed(reader, circle)).posts).toHaveLength(8);
    });
    it("routes post reports through safety and hides the blocked author's feed", async () => {
      const { posts } = await communityFeed(reader, circle);
      expect(
        await reportPost(reader, {
          postId: posts[0].id,
          reason: "spam",
          details: "Test evidence",
        }),
      ).toBe(true);
      const [evidence] = await database
        .select()
        .from(schema.report)
        .where(eq(schema.report.reporterId, reader));
      expect(evidence.postId).toBe(posts[0].id);
      expect(evidence.details).toContain(posts[0].body);
      expect((await communityFeed(reader, circle)).posts).toHaveLength(0);
    });
    it("executes the operations KPI SQL with real tables", async () => {
      const metrics = await overviewMetrics("Asia/Baku", new Date());
      expect(metrics.reports).toBeGreaterThanOrEqual(1);
      expect(metrics.signupsWeek).toBeGreaterThanOrEqual(2);
      expect(metrics.sessionsWeek).toBeGreaterThanOrEqual(4);
      expect(metrics.waiting).toBe(0);
    });
  },
);
