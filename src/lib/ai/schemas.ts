import { z } from "zod";

export const BLANK = "____";

// Strict objects (additionalProperties: false) and no optional fields, as
// OpenAI structured outputs require. Lengths are enforced after parsing.
export const analysisSchema = z.strictObject({
  language: z
    .string()
    .describe("BCP-47 code of the explanation's language, e.g. en, de, pt-BR"),
  clarityScore: z.number().int().min(0).max(100),
  gaps: z.array(z.string()).max(5),
  mistakes: z.array(z.string()).max(5),
  rewriteSuggestion: z.string(),
});

export const questionSchema = z.strictObject({
  type: z.enum(["open", "true_false", "cloze"]),
  prompt: z.string(),
  answer: z.string(),
  explanation: z.string(),
});

export const questionsSchema = z.strictObject({
  questions: z.array(questionSchema).min(1).max(5),
});

export const analysisWithQuestionsSchema = z.strictObject({
  analysis: analysisSchema,
  questions: z.array(questionSchema).min(1).max(5),
});

export const gradeSchema = z.strictObject({
  verdict: z.enum(["correct", "partial", "incorrect"]),
  feedback: z.string(),
});

export type Analysis = z.infer<typeof analysisSchema>;
export type GeneratedQuestion = z.infer<typeof questionSchema>;
export type Grade = z.infer<typeof gradeSchema>;

/** Rejects questions that violate the product rules, after the model answered. */
export function isUsableQuestion(q: GeneratedQuestion) {
  if (
    !q.prompt.trim() ||
    !q.answer.trim() ||
    q.prompt.length > 500 ||
    q.answer.length > 300
  )
    return false;
  if (q.type === "cloze")
    return (
      q.prompt.split(BLANK).length === 2 &&
      q.answer.trim().split(/\s+/).length <= 6
    );
  if (q.type === "true_false")
    return ["true", "false"].includes(q.answer.trim().toLowerCase());
  return true;
}

export function normalizeQuestion(q: GeneratedQuestion): GeneratedQuestion {
  return {
    type: q.type,
    prompt: q.prompt.trim(),
    answer:
      q.type === "true_false" ? q.answer.trim().toLowerCase() : q.answer.trim(),
    explanation: q.explanation.trim().slice(0, 500),
  };
}
