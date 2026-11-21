import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  booking,
  challenge,
  challengeMember,
  profile,
} from "@/src/lib/db/schema";

export type Challenge = typeof challenge.$inferSelect;

export async function listChallenges() {
  const rows = await db()
    .select({
      challenge,
      members: sql<number>`(select count(*)::int from ${challengeMember} m where m.challenge_id = ${challenge.id})`,
    })
    .from(challenge)
    .orderBy(desc(challenge.startsAt));
  return rows.map((r) => ({ ...r.challenge, members: r.members }));
}

export async function getChallengeBySlug(slug: string) {
  const [row] = await db()
    .select()
    .from(challenge)
    .where(eq(challenge.slug, slug));
  return row;
}

export async function isMember(challengeId: string, userId: string) {
  const [row] = await db()
    .select()
    .from(challengeMember)
    .where(
      and(
        eq(challengeMember.challengeId, challengeId),
        eq(challengeMember.userId, userId),
      ),
    );
  return Boolean(row);
}

export async function joinChallenge(challengeId: string, userId: string) {
  const [c] = await db()
    .select()
    .from(challenge)
    .where(eq(challenge.id, challengeId));
  if (!c || c.endsAt <= new Date()) return false;
  await db()
    .insert(challengeMember)
    .values({ challengeId, userId })
    .onConflictDoNothing();
  return true;
}

export async function leaveChallenge(challengeId: string, userId: string) {
  await db()
    .delete(challengeMember)
    .where(
      and(
        eq(challengeMember.challengeId, challengeId),
        eq(challengeMember.userId, userId),
      ),
    );
}

/** Members ranked by finished sessions or minutes inside the challenge window. */
export async function leaderboard(c: Challenge, limit = 50) {
  const score =
    c.goalType === "minutes"
      ? sql<number>`coalesce(sum(${booking.durationMin}), 0)::int`
      : sql<number>`count(${booking.id})::int`;
  return db()
    .select({
      userId: challengeMember.userId,
      name: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      score,
    })
    .from(challengeMember)
    .innerJoin(profile, eq(profile.userId, challengeMember.userId))
    .leftJoin(
      booking,
      and(
        eq(booking.userId, challengeMember.userId),
        eq(booking.status, "completed"),
        gte(booking.startAt, c.startsAt),
        lt(booking.startAt, c.endsAt),
      ),
    )
    .where(eq(challengeMember.challengeId, c.id))
    .groupBy(
      challengeMember.userId,
      profile.displayName,
      profile.username,
      profile.avatarUrl,
    )
    .orderBy(desc(score), profile.displayName)
    .limit(limit);
}
