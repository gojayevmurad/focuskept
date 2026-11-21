// SPDX-License-Identifier: AGPL-3.0-only
// Pure streak math over completed sessions. Days and weeks are in the user's zone.
import { localDayKey, weekBounds } from "@/src/lib/scheduling/slots";

const DAY = 86_400_000;

function previousDayKey(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  return new Date(d.getTime() - DAY).toISOString().slice(0, 10);
}

/**
 * Consecutive local days with at least one completed session, counting back
 * from today. A streak survives until the end of today even if today has no
 * session yet.
 */
export function dailyStreak(
  sessionStarts: Date[],
  timeZone: string,
  now = new Date(),
) {
  const days = new Set(sessionStarts.map((d) => localDayKey(d, timeZone)));
  let key = localDayKey(now, timeZone);
  if (!days.has(key)) key = previousDayKey(key);
  let streak = 0;
  while (days.has(key)) {
    streak++;
    key = previousDayKey(key);
  }
  return streak;
}

/** Consecutive local weeks (Monday start) with at least one completed session. */
export function weeklyStreak(
  sessionStarts: Date[],
  timeZone: string,
  now = new Date(),
) {
  const weeks = new Set(
    sessionStarts.map((d) => weekBounds(d, timeZone).start.getTime()),
  );
  let start = weekBounds(now, timeZone).start;
  if (!weeks.has(start.getTime()))
    start = weekBounds(new Date(start.getTime() - DAY), timeZone).start;
  let streak = 0;
  while (weeks.has(start.getTime())) {
    streak++;
    start = weekBounds(new Date(start.getTime() - DAY), timeZone).start;
  }
  return streak;
}

export function longestDailyStreak(sessionStarts: Date[], timeZone: string) {
  const keys = [
    ...new Set(sessionStarts.map((d) => localDayKey(d, timeZone))),
  ].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of keys) {
    run = prev && previousDayKey(key) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}
