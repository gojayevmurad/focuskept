import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { focusSession, profile, sessionParticipant } from "@/src/lib/db/schema";
import { addMinutes } from "@/src/lib/scheduling/slots";
import { ROOM_OPENS_MIN } from "@/src/lib/scheduling/slots";

export type RoomParticipant = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  goalText: string | null;
  outcome: string | null;
  joinedAt: Date | null;
  leftAt: Date | null;
  videoSessionId: string | null;
  tracks: { audio?: string; video?: string } | null;
};

export async function getFocusSession(id: string) {
  const [row] = await db()
    .select()
    .from(focusSession)
    .where(eq(focusSession.id, id));
  return row;
}

export async function listParticipants(
  sessionId: string,
): Promise<RoomParticipant[]> {
  return db()
    .select({
      userId: sessionParticipant.userId,
      displayName: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      goalText: sessionParticipant.goalText,
      outcome: sessionParticipant.outcome,
      joinedAt: sessionParticipant.joinedAt,
      leftAt: sessionParticipant.leftAt,
      videoSessionId: sessionParticipant.videoSessionId,
      tracks: sessionParticipant.tracks,
    })
    .from(sessionParticipant)
    .innerJoin(profile, eq(profile.userId, sessionParticipant.userId))
    .where(eq(sessionParticipant.sessionId, sessionId));
}

export async function getParticipant(sessionId: string, userId: string) {
  const [row] = await db()
    .select()
    .from(sessionParticipant)
    .where(
      and(
        eq(sessionParticipant.sessionId, sessionId),
        eq(sessionParticipant.userId, userId),
      ),
    );
  return row;
}

export type RoomWindow = "early" | "open" | "over";

/** The room opens a few minutes before the start and closes at the end. */
export function roomWindow(
  s: { startAt: Date; durationMin: number; status: string },
  now = new Date(),
): RoomWindow {
  if (s.status === "cancelled" || s.status === "ended") return "over";
  if (now < addMinutes(s.startAt, -ROOM_OPENS_MIN)) return "early";
  if (now >= addMinutes(s.startAt, s.durationMin)) return "over";
  return "open";
}

/**
 * Loads the session for a participant who may use its room right now.
 * Returns null for anyone else, so callers can answer 404 without leaking existence.
 */
export async function authorizeRoom(sessionId: string, userId: string) {
  const session = await getFocusSession(sessionId);
  if (!session) return null;
  const participant = await getParticipant(sessionId, userId);
  if (!participant) return null;
  return { session, participant, window: roomWindow(session) };
}
