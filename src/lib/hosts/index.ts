import "server-only";
import { and, avg, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  booking,
  focusSession,
  host,
  hostRating,
  profile,
  sessionParticipant,
} from "@/src/lib/db/schema";
import { getEnv } from "@/src/config/env";
import { checkBookable } from "@/src/lib/scheduling/slots";
import { publish } from "@/src/lib/realtime/publish";
import { notifyAdmins } from "@/src/lib/notifications";

export const GROUP_CAPACITY = 9;

export async function getHost(userId: string) {
  const [row] = await db().select().from(host).where(eq(host.userId, userId));
  return row;
}

export async function completedCount(userId: string) {
  const [{ n }] = await db()
    .select({ n: count() })
    .from(booking)
    .where(and(eq(booking.userId, userId), eq(booking.status, "completed")));
  return n;
}

export async function applyToHost(
  userId: string,
  pitch: string,
  audienceUrl: string | null,
) {
  const needed = getEnv().HOST_MIN_SESSIONS;
  if ((await completedCount(userId)) < needed)
    return { ok: false as const, reason: "not_eligible" };
  const existing = await getHost(userId);
  if (existing && existing.status !== "rejected")
    return { ok: false as const, reason: "exists" };
  await db()
    .insert(host)
    .values({ userId, pitch, audienceUrl, status: "applied" })
    .onConflictDoUpdate({
      target: host.userId,
      set: {
        pitch,
        audienceUrl,
        status: "applied",
        appliedAt: new Date(),
        decidedAt: null,
      },
    });
  void notifyAdmins(
    "host_application",
    `${userId}:${Date.now()}`,
    "New host application",
    ["Someone applied to host group sessions."],
    "/admin/hosts",
  ).catch(() => {});
  return { ok: true as const };
}

export async function createGroupSession(input: {
  hostId: string;
  startAt: Date;
  durationMin: number;
  title: string;
  capacity: number;
}) {
  const h = await getHost(input.hostId);
  if (h?.status !== "approved")
    return { ok: false as const, reason: "not_host" };
  const check = checkBookable(input.startAt, input.durationMin);
  if (!check.ok) return { ok: false as const, reason: check.reason };
  const capacity = Math.max(2, Math.min(GROUP_CAPACITY, input.capacity));
  const id = crypto.randomUUID();
  try {
    await db().transaction(async (tx) => {
      await tx.insert(focusSession).values({
        id,
        startAt: input.startAt,
        durationMin: input.durationMin,
        type: "group",
        hostId: input.hostId,
        title: input.title,
        capacity,
      });
      const bookingId = crypto.randomUUID();
      await tx.insert(booking).values({
        id: bookingId,
        userId: input.hostId,
        startAt: input.startAt,
        durationMin: input.durationMin,
        status: "matched",
        kind: "group",
        sessionId: id,
      });
      await tx
        .insert(sessionParticipant)
        .values({ sessionId: id, userId: input.hostId, bookingId });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return { ok: false as const, reason: "overlap" };
    throw error;
  }
  return { ok: true as const, id };
}

/** Cancels a hosted session; every seat is released without penalty. */
export async function cancelGroupSession(hostId: string, sessionId: string) {
  const [s] = await db()
    .select()
    .from(focusSession)
    .where(
      and(eq(focusSession.id, sessionId), eq(focusSession.hostId, hostId)),
    );
  if (!s || s.status !== "scheduled") return false;
  await db().transaction(async (tx) => {
    await tx
      .update(focusSession)
      .set({ status: "cancelled" })
      .where(eq(focusSession.id, sessionId));
    await tx
      .update(booking)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(
        and(
          eq(booking.sessionId, sessionId),
          inArray(booking.status, ["booked", "matched"]),
        ),
      );
  });
  await publish(`session:${sessionId}`, "session.ended", {
    cancelled: true,
  }).catch(() => {});
  return true;
}

export async function hostedSessions(hostId: string) {
  return db()
    .select({
      id: focusSession.id,
      startAt: focusSession.startAt,
      durationMin: focusSession.durationMin,
      title: focusSession.title,
      capacity: focusSession.capacity,
      status: focusSession.status,
      taken: sql<number>`(select count(*)::int from ${sessionParticipant} p where p.session_id = ${focusSession.id} and p.user_id <> ${hostId})`,
    })
    .from(focusSession)
    .where(
      and(
        eq(focusSession.hostId, hostId),
        gt(focusSession.startAt, new Date(Date.now() - 2 * 3600_000)),
      ),
    )
    .orderBy(focusSession.startAt);
}

/** Moves a hosted group into focus or wrap-up early. Only the host can. */
export async function setHostPhase(
  sessionId: string,
  hostId: string,
  phase: "focus" | "wrap",
) {
  const now = new Date();
  const updated = await db()
    .update(focusSession)
    .set(phase === "focus" ? { focusAt: now } : { wrapAt: now })
    .where(
      and(
        eq(focusSession.id, sessionId),
        eq(focusSession.hostId, hostId),
        inArray(focusSession.status, ["scheduled", "live"]),
      ),
    )
    .returning({ id: focusSession.id });
  if (updated.length)
    await publish(`session:${sessionId}`, "session.timer", { phase });
  return updated.length > 0;
}

export async function rateHost(
  sessionId: string,
  raterId: string,
  score: number,
) {
  const [s] = await db()
    .select()
    .from(focusSession)
    .where(eq(focusSession.id, sessionId));
  if (!s?.hostId || s.hostId === raterId || s.status !== "ended") return false;
  const [seat] = await db()
    .select()
    .from(sessionParticipant)
    .where(
      and(
        eq(sessionParticipant.sessionId, sessionId),
        eq(sessionParticipant.userId, raterId),
      ),
    );
  if (!seat?.joinedAt) return false;
  const value = Math.max(1, Math.min(5, Math.round(score)));
  await db()
    .insert(hostRating)
    .values({ sessionId, raterId, hostId: s.hostId, score: value })
    .onConflictDoUpdate({
      target: [hostRating.sessionId, hostRating.raterId],
      set: { score: value },
    });
  const [agg] = await db()
    .select({ avg: avg(hostRating.score), n: count() })
    .from(hostRating)
    .where(eq(hostRating.hostId, s.hostId));
  await db()
    .update(host)
    .set({ rating: agg.avg ? Number(agg.avg) : null, ratingsCount: agg.n })
    .where(eq(host.userId, s.hostId));
  return true;
}

export async function publicHosts(limit = 30) {
  return db()
    .select({
      userId: host.userId,
      name: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      rating: host.rating,
      ratingsCount: host.ratingsCount,
      sessionsHosted: host.sessionsHosted,
    })
    .from(host)
    .innerJoin(profile, eq(profile.userId, host.userId))
    .where(eq(host.status, "approved"))
    .orderBy(desc(host.sessionsHosted))
    .limit(limit);
}
