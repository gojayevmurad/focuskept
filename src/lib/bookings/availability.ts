import "server-only";
import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { booking, focusSession, profile, sessionParticipant } from "@/src/lib/db/schema";
import { addMinutes, isPopularSlot, nextSlot } from "@/src/lib/scheduling/slots";

/** How many other people are waiting in each slot of a range, per duration. */
export async function slotDemand(from: Date, to: Date, excludeUserId?: string) {
  const rows = await db()
    .select({
      startAt: booking.startAt,
      durationMin: booking.durationMin,
      n: sql<number>`count(*)::int`,
    })
    .from(booking)
    .where(
      and(
        gte(booking.startAt, from),
        lt(booking.startAt, to),
        eq(booking.kind, "pair"),
        inArray(booking.status, ["booked", "matched"]),
        ...(excludeUserId ? [ne(booking.userId, excludeUserId)] : []),
      ),
    )
    .groupBy(booking.startAt, booking.durationMin);
  const map = new Map<string, Record<number, number>>();
  for (const r of rows) {
    const key = r.startAt.toISOString();
    map.set(key, { ...(map.get(key) ?? {}), [r.durationMin]: r.n });
  }
  return map;
}

/** Good first slots in the next day: people waiting first, then popular hours. */
export async function suggestedSlots(userId: string, durationMin: number, now = new Date(), count = 6) {
  const from = nextSlot(addMinutes(now, 10));
  const to = addMinutes(now, 24 * 60);
  const demand = await slotDemand(from, to, userId);
  const slots: { startAt: Date; waiting: number; popular: boolean }[] = [];
  for (let t = from; t < to; t = addMinutes(t, 30)) {
    const waiting = demand.get(t.toISOString())?.[durationMin] ?? 0;
    slots.push({ startAt: t, waiting, popular: isPopularSlot(t) });
  }
  return slots
    .map((s) => ({ ...s, score: s.waiting * 10 + (s.popular ? 3 : 0) - s.startAt.getTime() / 3.6e9 / 24 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** Open hosted group sessions in a range, with seats taken. */
export async function groupSessionsBetween(from: Date, to: Date) {
  const rows = await db()
    .select({
      id: focusSession.id,
      startAt: focusSession.startAt,
      durationMin: focusSession.durationMin,
      title: focusSession.title,
      capacity: focusSession.capacity,
      hostId: focusSession.hostId,
      hostName: profile.displayName,
      hostUsername: profile.username,
      taken: sql<number>`(select count(*)::int from ${sessionParticipant} p where p.session_id = ${focusSession.id})`,
    })
    .from(focusSession)
    .leftJoin(profile, eq(profile.userId, focusSession.hostId))
    .where(
      and(
        eq(focusSession.type, "group"),
        eq(focusSession.isFallbackRoom, false),
        inArray(focusSession.status, ["scheduled", "live"]),
        gte(focusSession.startAt, from),
        lt(focusSession.startAt, to),
      ),
    )
    .orderBy(focusSession.startAt);
  return rows;
}
