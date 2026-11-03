import { z } from "zod";
import { BACKGROUND_SOUNDS } from "@/src/lib/db/json-types";
import { locales } from "@/src/i18n/config";
import { isTimeOfDay, isValidTimeZone } from "@/src/lib/dates";
import {
  LEARNING_METHODS,
  TIME_TECHNIQUES,
} from "@/src/features/techniques/slugs";
import {
  CUSTOM_LIMITS,
  MAX_CUSTOM_PRESETS,
  POMODORO_LIMITS,
  TIMEBOX_LIMITS,
  type DurationLimits,
} from "@/src/features/timer/limits";

const time = z.string().refine(isTimeOfDay);
const window = z.object({ start: time, end: time }).nullable();
const durations = (limits: DurationLimits) =>
  z.object({
    work: z.number().int().min(limits.work.min).max(limits.work.max),
    shortBreak: z
      .number()
      .int()
      .min(limits.shortBreak.min)
      .max(limits.shortBreak.max),
    longBreak: z
      .number()
      .int()
      .min(limits.longBreak.min)
      .max(limits.longBreak.max),
    cycles: z.number().int().min(limits.cycles.min).max(limits.cycles.max),
  });

export const reviewStepsSchema = z
  .tuple([z.number().int(), z.number().int(), z.number().int()])
  .refine(([a, b, c]) => a >= 1 && a < b && b < c && c <= 365);

export const timeZoneSchema = z.string().max(64).refine(isValidTimeZone);

export const preferencesPatchSchema = z
  .object({
    locale: z.enum(locales),
    timezone: timeZoneSchema,
    weekStartsOn: z.number().int().min(0).max(6),
    dailyReminderTime: time,
    workHours: z.object({
      "0": window,
      "1": window,
      "2": window,
      "3": window,
      "4": window,
      "5": window,
      "6": window,
    }),
    reviewSteps: reviewStepsSchema,
    defaultTimeTechnique: z.enum(TIME_TECHNIQUES),
    defaultLearningMethod: z.enum(LEARNING_METHODS),
    techniqueSettings: z
      .object({
        pomodoro: durations(POMODORO_LIMITS).partial(),
        custom: durations(CUSTOM_LIMITS).partial(),
        timeboxing: z
          .object({
            boxMinutes: z
              .number()
              .int()
              .min(TIMEBOX_LIMITS.min)
              .max(TIMEBOX_LIMITS.max),
          })
          .partial(),
      })
      .partial()
      .strict(),
    customPresets: z
      .array(
        durations(CUSTOM_LIMITS).extend({
          id: z.string().min(1).max(40),
          name: z.string().trim().min(1).max(40),
        }),
      )
      .max(MAX_CUSTOM_PRESETS),
    soundSettings: z.object({
      chime: z.boolean(),
      chimeVolume: z.number().min(0).max(1),
      background: z.enum(BACKGROUND_SOUNDS),
      backgroundVolume: z.number().min(0).max(1),
    }),
    weeklyFocusGoalMinutes: z.number().int().min(0).max(10080),
    emailReviews: z.boolean(),
    emailWeekly: z.boolean(),
    streakNudge: z.boolean(),
  })
  .partial()
  .strict();

export type PreferencesPatch = z.infer<typeof preferencesPatchSchema>;

export const preferencesInitSchema = z.object({
  timezone: timeZoneSchema,
  locale: z.enum(locales),
});
