import type { TimerDurations } from "@/src/lib/db/json-types";

type Range = { min: number; max: number };
export type DurationLimits = Record<keyof TimerDurations, Range>;

/** Allowed ranges (minutes / cycles) per configurable technique. */
export const POMODORO_LIMITS: DurationLimits = {
  work: { min: 10, max: 60 },
  shortBreak: { min: 3, max: 15 },
  longBreak: { min: 10, max: 30 },
  cycles: { min: 2, max: 6 },
};
export const CUSTOM_LIMITS: DurationLimits = {
  work: { min: 1, max: 180 },
  shortBreak: { min: 1, max: 60 },
  longBreak: { min: 1, max: 90 },
  cycles: { min: 1, max: 12 },
};
export const TIMEBOX_LIMITS: Range = { min: 5, max: 240 };
export const MAX_CUSTOM_PRESETS = 5;

export const POMODORO_DEFAULTS: TimerDurations = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
  cycles: 4,
};
export const CUSTOM_DEFAULTS: TimerDurations = {
  work: 45,
  shortBreak: 10,
  longBreak: 20,
  cycles: 3,
};
export const TIMEBOX_DEFAULT_MINUTES = 30;

export function clampDurations(
  value: Partial<TimerDurations> | undefined,
  defaults: TimerDurations,
  limits: DurationLimits,
): TimerDurations {
  const pick = (key: keyof TimerDurations) => {
    const v = value?.[key];
    if (typeof v !== "number" || !Number.isFinite(v)) return defaults[key];
    return Math.min(limits[key].max, Math.max(limits[key].min, Math.round(v)));
  };
  return {
    work: pick("work"),
    shortBreak: pick("shortBreak"),
    longBreak: pick("longBreak"),
    cycles: pick("cycles"),
  };
}
