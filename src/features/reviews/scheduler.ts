// Spaced-repetition scheduler. Pure and date-only:
// due dates are local calendar days in the user's timezone.
import { addDays, diffDays } from "@/src/lib/dates";

export const DEFAULT_STEPS = [5, 10, 30] as const;
export const GRADUATED_INTERVAL = 60;
export const MAX_INTERVAL = 180;
export const RELEARN_DAYS = 2;

export type CardSchedule = {
  /** Index into the user's steps; steps.length means graduated (60 → ×2 → 180). */
  step: number;
  intervalDays: number;
  dueOn: string;
  relearn: boolean;
};

/** A new card's first review: creation day + first step. */
export function initialSchedule(
  today: string,
  steps: readonly number[] = DEFAULT_STEPS,
): CardSchedule {
  return {
    step: 0,
    intervalDays: steps[0],
    dueOn: addDays(today, steps[0]),
    relearn: false,
  };
}

export function isDue(card: Pick<CardSchedule, "dueOn">, today: string) {
  return card.dueOn <= today;
}

/**
 * Applies a review result. Pass → next step (gap between steps, so late
 * reviews keep their spacing); after the last step 60 days, then doubling up
 * to 180. A relearn pass resumes the ladder from its step. Fail → same step,
 * due again in 2 days. Early reviews (before the due date) never change the
 * schedule, so they can't move it backwards.
 */
export function scheduleAfterReview(
  card: CardSchedule,
  input: { passed: boolean; today: string; steps?: readonly number[] },
): CardSchedule & { early: boolean } {
  const steps = input.steps ?? DEFAULT_STEPS;
  if (!isDue(card, input.today)) return { ...card, early: true };
  if (!input.passed)
    return {
      step: card.step,
      intervalDays: card.intervalDays,
      dueOn: addDays(input.today, RELEARN_DAYS),
      relearn: true,
      early: false,
    };
  const last = steps.length - 1;
  let step = card.step;
  let interval: number;
  if (step < last) {
    interval = steps[step + 1] - steps[step];
    step += 1;
  } else if (step === last) {
    interval = GRADUATED_INTERVAL;
    step = steps.length;
  } else {
    interval = card.relearn
      ? card.intervalDays
      : Math.min(card.intervalDays * 2, MAX_INTERVAL);
  }
  return {
    step,
    intervalDays: interval,
    dueOn: addDays(input.today, interval),
    relearn: false,
    early: false,
  };
}

export function daysOverdue(card: Pick<CardSchedule, "dueOn">, today: string) {
  return Math.max(0, diffDays(card.dueOn, today));
}

/** Retention = share of passed reviews. */
export function retentionRate(reviews: readonly { passed: boolean }[]) {
  if (!reviews.length) return null;
  return reviews.filter((r) => r.passed).length / reviews.length;
}
