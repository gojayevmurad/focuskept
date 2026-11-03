import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { learningDraft } from "@/src/lib/db/schema";
import {
  aiConfigured,
  AiError,
  analyzeAndGenerate,
  PROMPT_VERSION,
} from "@/src/lib/ai";
import {
  aiAllowance,
  LimitError,
  recordAiUsage,
  releaseAnalysis,
  reserveAnalysis,
} from "@/src/features/limits/server";

export const QUESTION_COUNT = 4;

export type AnalysisOutcome =
  | { ok: true; body: Record<string, unknown> }
  | {
      ok: false;
      status: number;
      error: string;
      extra?: Record<string, unknown>;
    };

/**
 * Reserve (limits, row lock) → call the model → store or give the
 * reservation back. Never throws for expected failures.
 */
export async function runAnalysis(input: {
  userId: string;
  sessionId: string;
  explanation: string;
  locale: string;
  timezone: string;
}): Promise<AnalysisOutcome> {
  if (!aiConfigured())
    return {
      ok: false,
      status: 503,
      error: "ai_unavailable",
      extra: { reason: "not_configured" },
    };
  let reservation;
  try {
    reservation = await reserveAnalysis(
      input.userId,
      input.sessionId,
      input.timezone,
    );
  } catch (error) {
    if (!(error instanceof LimitError)) throw error;
    if (error.code === "not_found")
      return { ok: false, status: 404, error: "not_found" };
    return {
      ok: false,
      status: error.code === "budget" ? 503 : 403,
      error: error.code,
      extra: { allowance: await aiAllowance(input.userId, input.timezone) },
    };
  }
  const { draft, period, consumedMonthly } = reservation;
  await db()
    .update(learningDraft)
    .set({ explanation: input.explanation, updatedAt: new Date() })
    .where(eq(learningDraft.id, draft.id));
  try {
    const { result, usage } = await analyzeAndGenerate({
      topic: draft.topic,
      explanation: input.explanation,
      locale: input.locale,
      count: QUESTION_COUNT,
    });
    const { language, ...analysis } = result.analysis;
    const questions = result.questions.map((q) => ({
      ...q,
      source: "ai" as const,
    }));
    await db()
      .update(learningDraft)
      .set({
        analysis,
        questions,
        language,
        promptVersion: PROMPT_VERSION,
        updatedAt: new Date(),
      })
      .where(eq(learningDraft.id, draft.id));
    await recordAiUsage(input.userId, period, usage, "analysis");
    return {
      ok: true,
      body: {
        analysis,
        language,
        questions,
        allowance: await aiAllowance(input.userId, input.timezone),
        analysesUsed: draft.analysisCount + 1,
      },
    };
  } catch (error) {
    if (!(error instanceof AiError)) throw error;
    await releaseAnalysis(input.userId, draft.id, period, consumedMonthly);
    await recordAiUsage(input.userId, period, error.usage, "analysis");
    return {
      ok: false,
      status: 503,
      error: "ai_unavailable",
      extra: { reason: error.reason },
    };
  }
}
