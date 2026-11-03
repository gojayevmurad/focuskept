import { addDays } from "@/src/lib/dates";

/** Longest run of consecutive days in a set of local dates. */
export function bestStreak(days: Iterable<string>) {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}
