import { z } from "zod";
import { BLANK } from "@/src/lib/ai/schemas";

export const EXPLANATION_MIN = 80;
export const EXPLANATION_MAX = 6000;
export const MAX_QUESTIONS = 20;

export const explanationSchema = z
  .string()
  .trim()
  .min(EXPLANATION_MIN)
  .max(EXPLANATION_MAX);

export const questionInputSchema = z
  .object({
    id: z.string().max(64).optional(),
    type: z.enum(["open", "true_false", "cloze"]),
    prompt: z.string().trim().min(1).max(500),
    answer: z.string().trim().min(1).max(300),
    explanation: z.string().trim().max(500).default(""),
    source: z.enum(["ai", "user", "ai_edited"]).default("user"),
  })
  .strict()
  .refine((q) => q.type !== "cloze" || q.prompt.split(BLANK).length === 2, {
    path: ["prompt"],
  })
  .refine(
    (q) =>
      q.type !== "true_false" ||
      ["true", "false"].includes(q.answer.toLowerCase()),
    { path: ["answer"] },
  );

export type QuestionInput = z.infer<typeof questionInputSchema>;

export const cardCreateSchema = z
  .object({
    sessionId: z.string().min(1).max(64),
    explanation: explanationSchema,
    questions: z.array(questionInputSchema).min(1).max(MAX_QUESTIONS),
  })
  .strict();

export const cardUpdateSchema = z
  .object({
    topic: z.string().trim().min(1).max(200),
    explanation: explanationSchema,
    status: z.enum(["active", "archived"]),
    subjectId: z.string().max(64).nullable(),
    questions: z.array(questionInputSchema).min(1).max(MAX_QUESTIONS),
  })
  .partial()
  .strict();

export const draftPatchSchema = z
  .object({ explanation: z.string().max(EXPLANATION_MAX) })
  .strict();
