import "server-only";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { getEnv } from "@/src/config/env";
import { logger } from "@/src/lib/logger";
import {
  analysisSchema,
  analysisWithQuestionsSchema,
  gradeSchema,
  isUsableQuestion,
  normalizeQuestion,
  questionsSchema,
  type Analysis,
  type GeneratedQuestion,
  type Grade,
} from "./schemas";
import {
  analysisSystemPrompt,
  gradingSystemPrompt,
  PROMPT_VERSION,
  questionsSystemPrompt,
  wrap,
} from "./prompts";

export { PROMPT_VERSION };
export type { Analysis, GeneratedQuestion, Grade };
export type AiUsage = { inputTokens: number; outputTokens: number };
export type AiResult<T> = { result: T; usage: AiUsage };

export type AiFailure =
  | "not_configured"
  | "timeout"
  | "invalid_output"
  | "refused"
  | "provider_error";
export class AiError extends Error {
  constructor(
    public reason: AiFailure,
    public usage: AiUsage = { inputTokens: 0, outputTokens: 0 },
  ) {
    super(`AI unavailable: ${reason}`);
  }
}

export function aiConfigured() {
  return Boolean(getEnv().OPENAI_API_KEY);
}

let client: OpenAI | undefined;
function openai() {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) throw new AiError("not_configured");
  client ??= new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.AI_BASE_URL || undefined,
    timeout: env.AI_TIMEOUT_MS,
    maxRetries: 1,
  });
  return client;
}

/** Test hook: forget the cached client after env changes. */
export function resetAiClient() {
  client = undefined;
}

/**
 * One structured-output request validated with zod. Invalid output is retried
 * once; the whole call (including retries) is bounded by AI_TIMEOUT_MS.
 * Only metadata is logged: never prompts, explanations or answers.
 */
async function structured<S extends z.ZodType>(
  operation: string,
  schema: S,
  system: string,
  user: string,
  check: (value: z.infer<S>) => boolean = () => true,
): Promise<AiResult<z.infer<S>>> {
  const env = getEnv();
  const usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
  const signal = AbortSignal.timeout(env.AI_TIMEOUT_MS);
  for (let attempt = 1; attempt <= 2; attempt++) {
    let content: string | null | undefined;
    try {
      const response = await openai().chat.completions.create(
        {
          model: env.AI_MODEL,
          temperature: 0.3,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: zodResponseFormat(schema, operation),
        },
        { signal },
      );
      usage.inputTokens += response.usage?.prompt_tokens ?? 0;
      usage.outputTokens += response.usage?.completion_tokens ?? 0;
      logger.info(
        {
          operation,
          model: env.AI_MODEL,
          attempt,
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          promptVersion: PROMPT_VERSION,
        },
        "AI call completed",
      );
      const message = response.choices[0]?.message;
      if (message?.refusal) throw new AiError("refused", usage);
      content = message?.content;
    } catch (error) {
      if (error instanceof AiError) throw error;
      const timedOut =
        signal.aborted ||
        (error instanceof Error &&
          /timeout|abort/i.test(error.name + error.message));
      logger.warn(
        { operation, attempt, reason: timedOut ? "timeout" : "provider_error" },
        "AI call failed",
      );
      throw new AiError(timedOut ? "timeout" : "provider_error", usage);
    }
    try {
      const parsed = schema.safeParse(JSON.parse(content ?? ""));
      if (parsed.success && check(parsed.data))
        return { result: parsed.data, usage };
    } catch {}
    logger.warn({ operation, attempt }, "AI output failed validation");
  }
  throw new AiError("invalid_output", usage);
}

function userMessage(topic: string, explanation: string, locale: string) {
  return [
    `UI locale: ${locale}`,
    wrap("topic", topic),
    wrap("explanation", explanation),
  ].join("\n\n");
}

const usableQuestions = (questions: GeneratedQuestion[]) =>
  questions.map(normalizeQuestion).filter(isUsableQuestion);

export async function analyzeExplanation(input: {
  topic: string;
  explanation: string;
  locale: string;
}): Promise<AiResult<Analysis>> {
  return structured(
    "analyze_explanation",
    analysisSchema,
    analysisSystemPrompt(0),
    userMessage(input.topic, input.explanation, input.locale),
  );
}

export async function generateQuestions(input: {
  topic: string;
  explanation: string;
  analysis?: Analysis;
  locale: string;
  count: number;
}): Promise<AiResult<GeneratedQuestion[]>> {
  const language = input.analysis?.language ?? input.locale;
  const { result, usage } = await structured(
    "generate_questions",
    questionsSchema,
    questionsSystemPrompt(input.count),
    `${userMessage(input.topic, input.explanation, input.locale)}\n\nWrite the questions in: ${language}`,
    (value) => usableQuestions(value.questions).length > 0,
  );
  return { result: usableQuestions(result.questions), usage };
}

/** Analysis and questions in one request (cheaper and faster). */
export async function analyzeAndGenerate(input: {
  topic: string;
  explanation: string;
  locale: string;
  count: number;
}): Promise<AiResult<{ analysis: Analysis; questions: GeneratedQuestion[] }>> {
  const { result, usage } = await structured(
    "analyze_and_generate",
    analysisWithQuestionsSchema,
    analysisSystemPrompt(input.count),
    userMessage(input.topic, input.explanation, input.locale),
    (value) => usableQuestions(value.questions).length > 0,
  );
  return {
    result: {
      analysis: {
        ...result.analysis,
        gaps: result.analysis.gaps.slice(0, 5),
        mistakes: result.analysis.mistakes.slice(0, 5),
      },
      questions: usableQuestions(result.questions),
    },
    usage,
  };
}

export async function gradeOpenAnswer(input: {
  question: string;
  modelAnswer: string;
  explanation: string;
  userAnswer: string;
  locale: string;
}): Promise<AiResult<Grade>> {
  return structured(
    "grade_open_answer",
    gradeSchema,
    gradingSystemPrompt(),
    [
      `Write the feedback in: ${input.locale}`,
      wrap("question", input.question),
      wrap("model_answer", input.modelAnswer),
      wrap("learner_explanation", input.explanation),
      wrap("learner_answer", input.userAnswer),
    ].join("\n\n"),
  );
}
