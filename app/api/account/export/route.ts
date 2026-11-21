import { eq, or } from "drizzle-orm";
import { getSession } from "@/src/lib/auth/session";
import { db } from "@/src/lib/db";
import {
  block,
  booking,
  challengeMember,
  communityMember,
  favorite,
  host,
  profile,
  referral,
  report,
  sessionParticipant,
  subscription,
  user,
} from "@/src/lib/db/schema";
import { rateLimit } from "@/src/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GDPR data export: everything we hold about the signed-in person, as JSON. */
export async function GET() {
  const session = await getSession();
  if (!session?.user.emailVerified) return new Response(null, { status: 401 });
  const id = session.user.id;
  if (!(await rateLimit(`export:${id}`, 5, 3600)))
    return new Response(null, { status: 429 });
  const [account] = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      analyticsConsent: user.analyticsConsent,
    })
    .from(user)
    .where(eq(user.id, id));
  const data = {
    exportedAt: new Date().toISOString(),
    account,
    profile: await db().select().from(profile).where(eq(profile.userId, id)),
    bookings: await db().select().from(booking).where(eq(booking.userId, id)),
    sessions: await db()
      .select({
        sessionId: sessionParticipant.sessionId,
        goal: sessionParticipant.goalText,
        outcome: sessionParticipant.outcome,
        joinedAt: sessionParticipant.joinedAt,
        leftAt: sessionParticipant.leftAt,
      })
      .from(sessionParticipant)
      .where(eq(sessionParticipant.userId, id)),
    favorites: await db()
      .select()
      .from(favorite)
      .where(eq(favorite.userId, id)),
    blocks: await db().select().from(block).where(eq(block.blockerId, id)),
    reportsMade: await db()
      .select({
        id: report.id,
        reason: report.reason,
        details: report.details,
        createdAt: report.createdAt,
      })
      .from(report)
      .where(eq(report.reporterId, id)),
    referrals: await db()
      .select()
      .from(referral)
      .where(or(eq(referral.referrerId, id), eq(referral.refereeId, id))),
    challenges: await db()
      .select()
      .from(challengeMember)
      .where(eq(challengeMember.userId, id)),
    groups: await db()
      .select()
      .from(communityMember)
      .where(eq(communityMember.userId, id)),
    host: await db().select().from(host).where(eq(host.userId, id)),
    subscriptions: await db()
      .select()
      .from(subscription)
      .where(eq(subscription.userId, id)),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
