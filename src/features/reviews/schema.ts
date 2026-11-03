import { z } from "zod";

export const reviewAnswerSchema = z
  .object({
    questionId: z.string().min(1).max(64),
    answer: z.string().max(2000),
    verdict: z.enum(["correct", "partial", "incorrect"]).optional(),
    feedback: z.string().max(500).optional(),
    gradedBy: z.enum(["rule", "ai", "self"]),
  })
  .strict();

export const reviewSubmitSchema = z
  .object({
    cardId: z.string().min(1).max(64),
    clientId: z.uuid(),
    answers: z.array(reviewAnswerSchema).min(1).max(20),
  })
  .strict();

export const gradeRequestSchema = z
  .object({
    questionId: z.string().min(1).max(64),
    answer: z.string().trim().min(1).max(2000),
  })
  .strict();

export type ReviewSubmit = z.infer<typeof reviewSubmitSchema>;
