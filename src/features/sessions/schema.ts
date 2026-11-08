import { z } from "zod";
import {
  LEARNING_METHODS,
  PLANNING_TECHNIQUES,
  TIME_TECHNIQUES,
} from "@/src/features/techniques/slugs";

const DAY = 86_400;
const MAX_CLOCK_SKEW = 86_400_000;

export const sessionSourceUrl = z.url({ protocol: /^https?$/ }).max(2000);

export const learningNotesSchema = z
  .object({
    notes: z.string().max(20_000),
    cornell: z.object({
      notes: z.string().max(20_000),
      cues: z.string().max(5_000),
      summary: z.string().max(5_000),
    }),
    blurting: z.object({
      dump: z.string().max(20_000),
      compare: z.string().max(20_000),
    }),
    interleaving: z.object({
      topics: z.array(z.string().trim().min(1).max(120)).min(2).max(4),
    }),
    sq3r: z
      .object({
        survey: z.string().max(10_000),
        question: z.string().max(10_000),
        read: z.string().max(10_000),
        recite: z.string().max(10_000),
        review: z.string().max(10_000),
      })
      .partial(),
  })
  .partial();

export const sessionCreateSchema = z
  .object({
    clientId: z.uuid(),
    mode: z.enum(["work", "learning"]),
    timeTechnique: z.enum(TIME_TECHNIQUES),
    learningMethod: z.enum(LEARNING_METHODS).optional(),
    planningTechnique: z.enum(PLANNING_TECHNIQUES).optional(),
    taskId: z.string().max(64).optional(),
    projectId: z.string().max(64).optional(),
    subjectId: z.string().max(64).optional(),
    taskDone: z.boolean().optional(),
    goal: z.string().trim().max(200).default(""),
    startedAt: z.iso.datetime({ offset: true }),
    endedAt: z.iso.datetime({ offset: true }),
    focusedSeconds: z.number().int().min(0).max(DAY),
    breakSeconds: z.number().int().min(0).max(DAY),
    cyclesCompleted: z.number().int().min(0).max(200),
    interruptions: z.number().int().min(0).max(5000),
    overrunSeconds: z.number().int().min(0).max(DAY),
    focusRating: z.number().int().min(1).max(5).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
    learning: z
      .object({
        topic: z.string().trim().min(1).max(200),
        sourceUrl: sessionSourceUrl.optional(),
        notes: learningNotesSchema.default({}),
      })
      .optional(),
  })
  .strict()
  .refine((s) => Date.parse(s.endedAt) >= Date.parse(s.startedAt), {
    path: ["endedAt"],
  })
  .refine(
    (s) =>
      s.focusedSeconds + s.breakSeconds <=
      (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 1000 + 120,
    { path: ["focusedSeconds"] },
  )
  .refine((s) => Date.parse(s.endedAt) <= Date.now() + MAX_CLOCK_SKEW, {
    path: ["endedAt"],
  })
  .refine((s) => s.mode === "work" || Boolean(s.learning && s.learningMethod), {
    path: ["learning"],
  });

export type SessionCreate = z.infer<typeof sessionCreateSchema>;

/** Device clocks can run ahead. Sessions up to a day "in the future" are shifted back. */
export const MAX_CLOCK_SKEW_MS = 86_400_000;

/** Shifts a session that ends after `now` (device clock ahead) so it ends at `now`. */
export function correctClockSkew(
  startedAt: string,
  endedAt: string,
  now = Date.now(),
) {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  const skew = Math.max(0, end - now);
  return { startedAt: new Date(start - skew), endedAt: new Date(end - skew) };
}

/** A session counts toward streaks and stats once at least a minute was focused. */
export const MIN_COMPLETED_SECONDS = 60;
