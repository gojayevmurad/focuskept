// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  block,
  communityMember,
  communityPost,
  communityReaction,
  profile,
  report,
  sessionParticipant,
} from "@/src/lib/db/schema";
import { reportUser } from "@/src/lib/safety";
import {
  FEED_PAGE_SIZE,
  POST_LIMIT,
  feedCursor,
  postInput,
  postReportInput,
} from "./validation";

// Mutual blocks also hide posts and prevent interactions, matching the safety flow.
function visibleTo(userId: string) {
  return and(
    isNull(communityPost.deletedAt),
    isNull(profile.suspendedAt),
    sql`not exists (select 1 from ${block} b where (b.blocker_id = ${userId} and b.blocked_id = ${communityPost.userId}) or (b.blocked_id = ${userId} and b.blocker_id = ${communityPost.userId}))`,
  );
}
export async function communityFeed(
  userId: string,
  groupId?: string,
  cursor?: string,
) {
  const before = feedCursor(cursor);
  const rows = await db()
    .select({
      id: communityPost.id,
      userId: communityPost.userId,
      body: communityPost.body,
      kind: communityPost.kind,
      automatic: communityPost.automatic,
      sessionId: communityPost.sessionId,
      createdAt: communityPost.createdAt,
      name: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      cheers: sql<number>`(select count(*)::int from ${communityReaction} r where r.post_id = ${communityPost.id})`,
      cheered: sql<boolean>`exists (select 1 from ${communityReaction} r where r.post_id = ${communityPost.id} and r.user_id = ${userId})`,
    })
    .from(communityPost)
    .innerJoin(profile, eq(profile.userId, communityPost.userId))
    .where(
      and(
        visibleTo(userId),
        groupId
          ? sql`exists (select 1 from ${communityMember} m where m.community_id = ${groupId} and m.user_id = ${communityPost.userId})`
          : undefined,
        before
          ? sql`(${communityPost.createdAt}, ${communityPost.id}) < (${before.at}::timestamptz, ${before.id})`
          : undefined,
      ),
    )
    .orderBy(desc(communityPost.createdAt), desc(communityPost.id))
    .limit(FEED_PAGE_SIZE + 1);
  const posts = rows.slice(0, FEED_PAGE_SIZE);
  const last = posts.at(-1);
  return {
    posts,
    next:
      rows.length > FEED_PAGE_SIZE && last
        ? Buffer.from(
            JSON.stringify({ at: last.createdAt.toISOString(), id: last.id }),
          ).toString("base64url")
        : null,
  };
}
export type FeedPost = Awaited<
  ReturnType<typeof communityFeed>
>["posts"][number];

export async function createPost(
  userId: string,
  input: unknown,
  now = new Date(),
) {
  const parsed = postInput.safeParse(input);
  if (!parsed.success) return { error: "invalid" as const };
  const values = parsed.data;
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`community-post:${userId}`}, 0))`,
    );
    const [{ n }] = await tx
      .select({ n: count() })
      .from(communityPost)
      .where(
        and(
          eq(communityPost.userId, userId),
          gte(communityPost.createdAt, new Date(now.getTime() - 3600_000)),
        ),
      );
    if (n >= POST_LIMIT) return { error: "rateLimit" as const };
    if (values.groupId) {
      const [member] = await tx
        .select()
        .from(communityMember)
        .where(
          and(
            eq(communityMember.communityId, values.groupId),
            eq(communityMember.userId, userId),
          ),
        );
      if (!member) return { error: "membership" as const };
    }
    if (values.sessionId) {
      const [seat] = await tx
        .select()
        .from(sessionParticipant)
        .where(
          and(
            eq(sessionParticipant.sessionId, values.sessionId),
            eq(sessionParticipant.userId, userId),
          ),
        );
      if (!seat) return { error: "session" as const };
    }
    await tx
      .insert(communityPost)
      .values({ id: crypto.randomUUID(), userId, ...values, createdAt: now });
    return { ok: true as const };
  });
}
export async function deletePost(userId: string, postId: string) {
  return db()
    .update(communityPost)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(communityPost.id, postId),
        eq(communityPost.userId, userId),
        isNull(communityPost.deletedAt),
      ),
    )
    .returning({ id: communityPost.id });
}
async function visiblePost(userId: string, postId: string) {
  const [post] = await db()
    .select({
      id: communityPost.id,
      userId: communityPost.userId,
      body: communityPost.body,
    })
    .from(communityPost)
    .innerJoin(profile, eq(profile.userId, communityPost.userId))
    .where(and(eq(communityPost.id, postId), visibleTo(userId)));
  return post;
}
export async function cheerPost(
  userId: string,
  postId: string,
  cheer: boolean,
) {
  if (!(await visiblePost(userId, postId))) return false;
  if (cheer)
    await db()
      .insert(communityReaction)
      .values({ postId, userId })
      .onConflictDoNothing();
  else
    await db()
      .delete(communityReaction)
      .where(
        and(
          eq(communityReaction.postId, postId),
          eq(communityReaction.userId, userId),
        ),
      );
  return true;
}
export async function reportPost(userId: string, input: unknown) {
  const parsed = postReportInput.safeParse(input);
  if (!parsed.success) return false;
  const post = await visiblePost(userId, parsed.data.postId);
  if (!post || post.userId === userId) return false;
  const id = await reportUser({
    reporterId: userId,
    targetId: post.userId,
    reason: parsed.data.reason,
    details: `[Community post ${post.id}]\n${post.body}\n\n${parsed.data.details}`,
  });
  if (!id) return false;
  await db().update(report).set({ postId: post.id }).where(eq(report.id, id));
  return true;
}
export async function setAutomaticWins(userId: string, enabled: boolean) {
  await db()
    .update(profile)
    .set({ shareWinsAutomatically: enabled })
    .where(eq(profile.userId, userId));
}

export async function postSessionOptions(userId: string) {
  const rows = await db()
    .select({
      id: sessionParticipant.sessionId,
      goal: sessionParticipant.goalText,
    })
    .from(sessionParticipant)
    .where(eq(sessionParticipant.userId, userId))
    .limit(50);
  return rows.map((row) => ({
    id: row.id,
    label: row.goal?.slice(0, 60) || row.id.slice(0, 8),
  }));
}
