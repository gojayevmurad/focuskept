import { addDays } from "@/src/lib/dates";

/** A streak day has ≥1 completed session with at least this many focused seconds. */
export const STREAK_MIN_SECONDS = 600;

/**
 * Consecutive streak days ending today, or yesterday when today has no session
 * yet (the streak is still alive until the day ends).
 */
export function computeStreak(days: Iterable<string>, today: string) {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
