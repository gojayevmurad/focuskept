import { z } from "zod";
import {
  PLANNING_TECHNIQUES,
  TIME_TECHNIQUES,
} from "@/src/features/techniques/slugs";
import { MAX_CLOCK_SKEW_MS } from "@/src/features/sessions/schema";

const iso = z.iso.datetime({ offset: true });

export const importTaskSchema = z.object({
  clientId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  status: z.enum(["todo", "done"]),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(32))
    .max(10)
    .default([]),
  createdAt: iso,
  completedAt: iso.optional(),
});

export const importSessionSchema = z
  .object({
    clientId: z.uuid(),
    mode: z.literal("work"),
    timeTechnique: z.enum(TIME_TECHNIQUES),
    planningTechnique: z.enum(PLANNING_TECHNIQUES).optional(),
    taskClientId: z.uuid().optional(),
    goal: z.string().max(200).default(""),
    startedAt: iso,
    endedAt: iso,
    focusedSeconds: z.number().int().min(0).max(86_400),
    breakSeconds: z.number().int().min(0).max(86_400),
    cyclesCompleted: z.number().int().min(0).max(200),
    interruptions: z.number().int().min(0).max(5000),
    overrunSeconds: z.number().int().min(0).max(86_400),
    focusRating: z.number().int().min(1).max(5).nullable(),
    note: z.string().max(1000).nullable(),
  })
  .refine((s) => Date.parse(s.endedAt) >= Date.parse(s.startedAt))
  .refine((s) => Date.parse(s.endedAt) <= Date.now() + MAX_CLOCK_SKEW_MS);

export const importSchema = z
  .object({
    tasks: z.array(importTaskSchema).max(500),
    sessions: z.array(importSessionSchema).max(2000),
  })
  .strict();

export type ImportPayload = z.infer<typeof importSchema>;
export const IMPORT_MAX_BYTES = 1_500_000;
