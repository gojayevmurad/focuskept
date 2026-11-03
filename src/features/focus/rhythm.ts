import type { TimeTechnique } from "@/src/features/techniques/slugs";
import type { CustomPreset, TechniqueSettings } from "@/src/lib/db/json-types";
import { durationsFor, timeboxMinutes } from "@/src/features/timer/configs";

/** Rhythm order in the picker. Timeboxing is a Working-only rhythm. */
export const RHYTHMS: readonly TimeTechnique[] = [
  "pomodoro",
  "52-17",
  "deep-work-90",
  "flowtime",
  "timeboxing",
  "custom",
];

export const WORK_ONLY: readonly TimeTechnique[] = ["timeboxing"];

export type RhythmShape =
  | { kind: "cycle"; work: number; brk: number; blocks: number }
  | { kind: "flow" }
  | { kind: "box"; minutes: number };

export function rhythmShape(
  technique: TimeTechnique,
  settings: TechniqueSettings,
  options: { preset?: CustomPreset; boxMinutes?: number } = {},
): RhythmShape {
  if (technique === "flowtime") return { kind: "flow" };
  if (technique === "timeboxing")
    return {
      kind: "box",
      minutes: timeboxMinutes(settings, options.boxMinutes),
    };
  const d = durationsFor(technique, settings, options.preset)!;
  return { kind: "cycle", work: d.work, brk: d.shortBreak, blocks: d.cycles };
}

/** "25 · 5", "↑", or the box length, shown beside the rhythm name. */
export function rhythmMeta(shape: RhythmShape) {
  if (shape.kind === "flow") return "↑";
  if (shape.kind === "box") return `${shape.minutes}`;
  return `${shape.work} · ${shape.brk}`;
}
