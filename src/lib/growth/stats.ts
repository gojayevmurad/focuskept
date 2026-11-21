// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { booking, sessionParticipant } from "@/src/lib/db/schema";
import { localDayKey } from "@/src/lib/scheduling/slots";
import { dailyStreak, longestDailyStreak, weeklyStreak } from "./streaks";

export async function completedSessions(
  userId: string,
  from?: Date,
  to?: Date,
) {
  return db()
    .select({
      startAt: booking.startAt,
      durationMin: booking.durationMin,
      outcome: sessionParticipant.outcome,
      sessionId: booking.sessionId,
    })
    .from(booking)
    .leftJoin(
      sessionParticipant,
      and(
        eq(sessionParticipant.sessionId, booking.sessionId),
        eq(sessionParticipant.userId, booking.userId),
      ),
    )
    .where(
      and(
        eq(booking.userId, userId),
        eq(booking.status, "completed"),
        ...(from ? [gte(booking.startAt, from)] : []),
        ...(to ? [lt(booking.startAt, to)] : []),
      ),
    )
    .orderBy(booking.startAt);
}

export type UserStats = Awaited<ReturnType<typeof userStats>>;

export async function userStats(
  userId: string,
  timeZone: string,
  now = new Date(),
) {
  const rows = await completedSessions(userId);
  const starts = rows.map((r) => r.startAt);
  const minutes = rows.reduce((sum, r) => sum + r.durationMin, 0);
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const thisMonth = rows.filter((r) => r.startAt >= monthStart);
  const done = rows.filter((r) => r.outcome === "done").length;
  const rated = rows.filter((r) => r.outcome).length;
  // Last 12 weeks of minutes, oldest first, for the activity chart.
  const days = new Map<string, number>();
  for (const r of rows) {
    const key = localDayKey(r.startAt, timeZone);
    days.set(key, (days.get(key) ?? 0) + r.durationMin);
  }
  return {
    sessions: rows.length,
    hours: Math.round((minutes / 60) * 10) / 10,
    monthSessions: thisMonth.length,
    monthHours:
      Math.round((thisMonth.reduce((s, r) => s + r.durationMin, 0) / 60) * 10) /
      10,
    dailyStreak: dailyStreak(starts, timeZone, now),
    weeklyStreak: weeklyStreak(starts, timeZone, now),
    longestStreak: longestDailyStreak(starts, timeZone),
    completionRate: rated ? Math.round((done / rated) * 100) : null,
    days: Object.fromEntries(days),
  };
}
