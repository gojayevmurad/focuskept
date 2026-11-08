"use client";
import { z } from "zod";
import type { TimerConfig, TimerEvent } from "@/src/features/timer/engine";
import type {
  LearningMethod,
  PlanningTechnique,
  TimeTechnique,
} from "@/src/features/techniques/slugs";
import type { LearningNotes } from "@/src/lib/db/json-types";

/** The in-progress timer, persisted so it survives reloads and sleep. */
export type ActiveSession = {
  v: 1;
  clientId: string;
  mode: "work" | "learning";
  technique: TimeTechnique;
  config: TimerConfig;
  events: TimerEvent[];
  goal: string;
  task?: { id?: string; clientId?: string; title: string };
  /** Signed-in only: what the session counts toward in stats. */
  projectId?: string | null;
  subjectId?: string | null;
  planning?: PlanningTechnique;
  learning?: {
    method: LearningMethod;
    topic: string;
    sourceUrl?: string;
    topics?: string[];
    notes: LearningNotes;
  };
  createdAt: number;
};

export const ACTIVE_KEY = "focuskept:v1:active";

const eventSchema = z.object({
  type: z.enum([
    "start",
    "pause",
    "resume",
    "skip",
    "break",
    "extend",
    "finish",
  ]),
  at: z.number(),
});
const configSchema = z.union([
  z.object({
    kind: z.literal("cycle"),
    work: z.number(),
    shortBreak: z.number(),
    longBreak: z.number(),
    cycles: z.number(),
  }),
  z.object({
    kind: z.literal("flow"),
    ratio: z.number(),
    minBreak: z.number(),
    maxBreak: z.number(),
  }),
  z.object({
    kind: z.literal("box"),
    box: z.number(),
    extendRatio: z.number(),
  }),
]);
const activeSchema = z
  .object({
    v: z.literal(1),
    clientId: z.string(),
    mode: z.enum(["work", "learning"]),
    technique: z.string(),
    config: configSchema,
    events: z.array(eventSchema).max(5000),
    goal: z.string(),
    createdAt: z.number(),
  })
  .loose();

export function loadActive(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const parsed = activeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as unknown as ActiveSession) : null;
  } catch {
    return null;
  }
}

export function saveActive(session: ActiveSession) {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
  } catch {}
}

export function clearActive() {
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

export function newClientId() {
  return crypto.randomUUID();
}
