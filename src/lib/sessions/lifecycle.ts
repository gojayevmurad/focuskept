import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  booking,
  focusSession,
  host,
  sessionParticipant,
} from "@/src/lib/db/schema";
import { publish } from "@/src/lib/realtime/publish";
import { trackForUser } from "@/src/lib/analytics/product";
import { convertReferral } from "@/src/lib/growth/referrals";
import { logger } from "@/src/lib/logger";
import { authorizeRoom, listParticipants } from "./access";

export const GOAL_MAX = 280;
export const OUTCOMES = ["done", "partial", "not_done"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export async function joinRoom(
  sessionId: string,
  userId: string,
  now = new Date(),
) {
  const room = await authorizeRoom(sessionId, userId);
  if (!room || room.window !== "open") return null;
  await db()
    .update(sessionParticipant)
    .set({
      joinedAt: room.participant.joinedAt ?? now,
      leftAt: null,
    })
    .where(
      and(
        eq(sessionParticipant.sessionId, sessionId),
        eq(sessionParticipant.userId, userId),
      ),
    );
  if (room.session.status === "scheduled" && now >= room.session.startAt)
    await db()
      .update(focusSession)
      .set({ status: "live", startedAt: now })
      .where(
        and(
          eq(focusSession.id, sessionId),
          eq(focusSession.status, "scheduled"),
        ),
      );
  await publish(`session:${sessionId}`, "session.presence", {
    userId,
    joined: true,
  });
  if (!room.participant.joinedAt)
    void trackForUser(userId, "session_matched", { type: room.session.type });
  return room;
}

export async function leaveRoom(
  sessionId: string,
  userId: string,
  now = new Date(),
) {
  const room = await authorizeRoom(sessionId, userId);
  if (!room) return null;
  await db()
    .update(sessionParticipant)
    .set({ leftAt: now })
    .where(
      and(
        eq(sessionParticipant.sessionId, sessionId),
        eq(sessionParticipant.userId, userId),
      ),
    );
  await publish(`session:${sessionId}`, "session.presence", {
    userId,
    joined: false,
  });
  return room;
}

export async function setGoal(sessionId: string, userId: string, text: string) {
  const room = await authorizeRoom(sessionId, userId);
  if (!room || room.window === "over") return null;
  const goalText = text.trim().slice(0, GOAL_MAX);
  await db()
    .update(sessionParticipant)
    .set({ goalText })
    .where(
      and(
        eq(sessionParticipant.sessionId, sessionId),
        eq(sessionParticipant.userId, userId),
      ),
    );
  await publish(`session:${sessionId}`, "session.goal", { userId, goalText });
  return goalText;
}

/** Outcomes can be set during the session and for a day after it ends. */
export async function setOutcome(
  sessionId: string,
  userId: string,
  outcome: Outcome,
  now = new Date(),
) {
  const room = await authorizeRoom(sessionId, userId);
  if (!room) return null;
  const end =
    room.session.startAt.getTime() + room.session.durationMin * 60_000;
  if (now.getTime() > end + 24 * 3600_000) return null;
  await db()
    .update(sessionParticipant)
    .set({ outcome })
    .where(
      and(
        eq(sessionParticipant.sessionId, sessionId),
        eq(sessionParticipant.userId, userId),
      ),
    );
  await publish(`session:${sessionId}`, "session.outcome", { userId, outcome });
  return outcome;
}

export async function saveQuality(
  sessionId: string,
  userId: string,
  quality: Record<string, number | boolean>,
) {
  await db()
    .update(sessionParticipant)
    .set({ quality })
    .where(
      and(
        eq(sessionParticipant.sessionId, sessionId),
        eq(sessionParticipant.userId, userId),
      ),
    );
}

export async function roomState(sessionId: string, userId: string) {
  const room = await authorizeRoom(sessionId, userId);
  if (!room) return null;
  const participants = await listParticipants(sessionId);
  return {
    session: {
      id: room.session.id,
      type: room.session.type,
      title: room.session.title,
      hostId: room.session.hostId,
      startAt: room.session.startAt.toISOString(),
      durationMin: room.session.durationMin,
      status: room.session.status,
      isFallbackRoom: room.session.isFallbackRoom,
      focusAt: room.session.focusAt?.toISOString() ?? null,
      wrapAt: room.session.wrapAt?.toISOString() ?? null,
    },
    window: room.window,
    serverTime: new Date().toISOString(),
    me: userId,
    participants: participants.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      username: p.username,
      avatarUrl: p.avatarUrl,
      goalText: p.goalText,
      outcome: p.outcome,
      present: Boolean(p.joinedAt && !p.leftAt),
      joined: Boolean(p.joinedAt),
      tracks: p.tracks,
    })),
  };
}
export type RoomState = NonNullable<Awaited<ReturnType<typeof roomState>>>;

/**
 * Closes sessions whose time is up: attendees become `completed`, matched
 * people who never joined become `no_show`, and bookings that were never
 * matched are released.
 */
export async function completeEndedSessions(now = new Date()) {
  const ended = await db()
    .update(focusSession)
    .set({ status: "ended", endedAt: now })
    .where(
      and(
        inArray(focusSession.status, ["scheduled", "live"]),
        lte(
          sql`${focusSession.startAt} + make_interval(mins => ${focusSession.durationMin})`,
          now,
        ),
      ),
    )
    .returning();
  const completedUsers = new Set<string>();
  for (const s of ended) {
    const people = await db()
      .select()
      .from(sessionParticipant)
      .where(eq(sessionParticipant.sessionId, s.id));
    const attended = people
      .filter((p) => p.joinedAt)
      .map((p) => p.bookingId!)
      .filter(Boolean);
    const missed = people
      .filter((p) => !p.joinedAt)
      .map((p) => p.bookingId!)
      .filter(Boolean);
    if (attended.length)
      await db()
        .update(booking)
        .set({ status: "completed" })
        .where(
          and(inArray(booking.id, attended), eq(booking.status, "matched")),
        );
    if (missed.length)
      await db()
        .update(booking)
        .set({ status: "no_show" })
        .where(and(inArray(booking.id, missed), eq(booking.status, "matched")));
    for (const p of people) if (p.joinedAt) completedUsers.add(p.userId);
    if (s.hostId && people.some((p) => p.joinedAt && p.userId !== s.hostId))
      await db()
        .update(host)
        .set({ sessionsHosted: sql`${host.sessionsHosted} + 1` })
        .where(eq(host.userId, s.hostId));
    await publish(`session:${s.id}`, "session.ended", {}).catch(() => {});
  }
  // Nobody to pair with and no fallback taken.
  await db()
    .update(booking)
    .set({ status: "cancelled", cancelledAt: now })
    .where(
      and(
        eq(booking.status, "booked"),
        lte(
          sql`${booking.startAt} + make_interval(mins => ${booking.durationMin})`,
          now,
        ),
      ),
    );
  for (const userId of completedUsers) {
    void trackForUser(userId, "session_completed");
    await convertReferral(userId).catch((error) =>
      logger.warn({ err: error }, "Referral conversion failed"),
    );
  }
  return { ended: ended.length, completedUsers: completedUsers.size };
}

/** Bookings whose session starts within the reminder window. */
export async function bookingsNeedingReminder(now: Date, leadMin: number) {
  const from = new Date(now.getTime() + (leadMin - 1) * 60_000);
  const to = new Date(now.getTime() + (leadMin + 1) * 60_000);
  return db()
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        inArray(booking.status, ["booked", "matched"]),
        sql`${booking.startAt} > ${from} and ${booking.startAt} <= ${to}`,
      ),
    );
}
