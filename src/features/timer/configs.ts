import type { TimeTechnique } from "@/src/features/techniques/slugs";
import type {
  CustomPreset,
  TechniqueSettings,
  TimerDurations,
} from "@/src/lib/db/json-types";
import type { TimerConfig } from "./engine";
import {
  clampDurations,
  CUSTOM_DEFAULTS,
  CUSTOM_LIMITS,
  POMODORO_DEFAULTS,
  POMODORO_LIMITS,
  TIMEBOX_DEFAULT_MINUTES,
  TIMEBOX_LIMITS,
} from "./limits";

const MIN = 60_000;

/** Flowtime break = worked ÷ 5, clamped to 5–30 minutes (shown in the UI). */
export const FLOWTIME = {
  ratio: 5,
  minBreakMinutes: 5,
  maxBreakMinutes: 30,
} as const;
/** Timeboxing allows a single extension of 25% of the box. */
export const TIMEBOX_EXTEND_RATIO = 0.25;

function cycle(d: TimerDurations): TimerConfig {
  return {
    kind: "cycle",
    work: d.work * MIN,
    shortBreak: d.shortBreak * MIN,
    longBreak: d.longBreak * MIN,
    cycles: d.cycles,
  };
}

export function durationsFor(
  technique: TimeTechnique,
  settings: TechniqueSettings = {},
  preset?: CustomPreset,
): TimerDurations | null {
  switch (technique) {
    case "pomodoro":
      return clampDurations(
        settings.pomodoro,
        POMODORO_DEFAULTS,
        POMODORO_LIMITS,
      );
    case "52-17":
      return { work: 52, shortBreak: 17, longBreak: 17, cycles: 4 };
    case "deep-work-90":
      return { work: 90, shortBreak: 20, longBreak: 20, cycles: 4 };
    case "custom":
      return clampDurations(
        preset ?? settings.custom,
        CUSTOM_DEFAULTS,
        CUSTOM_LIMITS,
      );
    default:
      return null;
  }
}

export function timeboxMinutes(
  settings: TechniqueSettings = {},
  override?: number,
) {
  const value =
    override ?? settings.timeboxing?.boxMinutes ?? TIMEBOX_DEFAULT_MINUTES;
  return Math.min(
    TIMEBOX_LIMITS.max,
    Math.max(TIMEBOX_LIMITS.min, Math.round(value)),
  );
}

export function timerConfigFor(
  technique: TimeTechnique,
  options: {
    settings?: TechniqueSettings;
    preset?: CustomPreset;
    boxMinutes?: number;
  } = {},
): TimerConfig {
  if (technique === "flowtime")
    return {
      kind: "flow",
      ratio: FLOWTIME.ratio,
      minBreak: FLOWTIME.minBreakMinutes * MIN,
      maxBreak: FLOWTIME.maxBreakMinutes * MIN,
    };
  if (technique === "timeboxing")
    return {
      kind: "box",
      box: timeboxMinutes(options.settings, options.boxMinutes) * MIN,
      extendRatio: TIMEBOX_EXTEND_RATIO,
    };
  return cycle(durationsFor(technique, options.settings, options.preset)!);
}
