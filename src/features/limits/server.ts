import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { captureMessage } from "@sentry/nextjs";
import { db } from "@/src/lib/db";
import {
  aiDailyUsage,
  aiUsage,
  learningDraft,
  learningItem,
} from "@/src/lib/db/schema";
import { getEnv } from "@/src/config/env";
import { hasEntitlement } from "@/src/lib/billing/entitlements";
import { localDate, monthKey } from "@/src/lib/dates";
import { logger } from "@/src/lib/logger";
import type { AiUsage } from "@/src/lib/ai";
import {
  aiBlockedByBudget,
  budgetState,
  cardLimit,
  decideAnalysis,
  monthlyAiLimit,
  type Plan,
} from "./rules";

export async function getPlan(userId: string): Promise<Plan> {
  return {
    pro: await hasEntitlement(userId),
    proMonthlyAiCards: getEnv().PRO_MONTHLY_AI_CARDS,
  };
}

/** Calendar month in the user's timezone. */
export function usagePeriod(timezone: string, at = new Date()) {
  return monthKey(localDate(timezone, at));
}

/** Non-deleted cards (archived cards count toward the Free cap). */
export async function countCards(userId: string) {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(learningItem)
    .where(eq(learningItem.userId, userId));
  return row.n;
}

export async function cardAllowance(userId: string, plan?: Plan) {
  const p = plan ?? (await getPlan(userId));
  const used = await countCards(userId);
  const limit = cardLimit(p);
  return {
    used,
    limit: Number.isFinite(limit) ? limit : null,
    remaining: Number.isFinite(limit) ? Math.max(0, limit - used) : null,
  };
}

export async function monthlyUsage(userId: string, period: string) {
  const [row] = await db()
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.period, period)));
  return (
    row ?? {
      cardsAnalyzed: 0,
      answersGraded: 0,
      inputTokens: 0,
      outputTokens: 0,
    }
  );
}

export async function aiAllowance(
  userId: string,
  timezone: string,
  plan?: Plan,
) {
  const p = plan ?? (await getPlan(userId));
  const usage = await monthlyUsage(userId, usagePeriod(timezone));
  const limit = monthlyAiLimit(p);
  return {
    used: usage.cardsAnalyzed,
    limit,
    remaining: Math.max(0, limit - usage.cardsAnalyzed),
    pro: p.pro,
  };
}

const utcDay = () => new Date().toISOString().slice(0, 10);

export async function budgetBlocked(pro: boolean) {
  const budget = getEnv().AI_DAILY_TOKEN_BUDGET;
  if (!budget) return false;
  const [row] = await db()
    .select()
    .from(aiDailyUsage)
    .where(eq(aiDailyUsage.day, utcDay()));
  const used = row ? row.inputTokens + row.outputTokens : 0;
  return aiBlockedByBudget(budgetState(used, budget), pro);
}

/** Adds token usage to the user's month and the global day; warns once per threshold. */
export async function recordAiUsage(
  userId: string,
  period: string,
  usage: AiUsage,
  kind: "analysis" | "grading",
) {
  if (!usage.inputTokens && !usage.outputTokens && kind !== "grading") return;
  await db()
    .insert(aiUsage)
    .values({
      userId,
      period,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      answersGraded: kind === "grading" ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.period],
      set: {
        inputTokens: sql`${aiUsage.inputTokens} + ${usage.inputTokens}`,
        outputTokens: sql`${aiUsage.outputTokens} + ${usage.outputTokens}`,
        answersGraded: sql`${aiUsage.answersGraded} + ${kind === "grading" ? 1 : 0}`,
        updatedAt: new Date(),
      },
    });
  const day = utcDay();
  const [row] = await db()
    .insert(aiDailyUsage)
    .values({
      day,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    })
    .onConflictDoUpdate({
      target: aiDailyUsage.day,
      set: {
        inputTokens: sql`${aiDailyUsage.inputTokens} + ${usage.inputTokens}`,
        outputTokens: sql`${aiDailyUsage.outputTokens} + ${usage.outputTokens}`,
      },
    })
    .returning();
  const budget = getEnv().AI_DAILY_TOKEN_BUDGET;
  if (!budget || !row) return;
  const state = budgetState(row.inputTokens + row.outputTokens, budget);
  if (state === "ok") return;
  const column =
    state === "all_blocked"
      ? aiDailyUsage.allDisabledAt
      : aiDailyUsage.freeDisabledAt;
  const flagged = await db()
    .update(aiDailyUsage)
    .set(
      state === "all_blocked"
        ? { allDisabledAt: new Date() }
        : { freeDisabledAt: new Date() },
    )
    .where(and(eq(aiDailyUsage.day, day), sql`${column} is null`))
    .returning({ day: aiDailyUsage.day });
  if (flagged.length) {
    const message =
      state === "all_blocked"
        ? "AI daily token budget reached: AI disabled for everyone until tomorrow (UTC)"
        : "AI daily token budget at 80%: AI disabled for Free users until tomorrow (UTC)";
    logger.warn({ day, state }, message);
    captureMessage(message, "warning");
  }
}

export class LimitError extends Error {
  constructor(
    public code:
      | "monthly_limit"
      | "reanalysis_limit"
      | "card_limit"
      | "budget"
      | "not_found",
  ) {
    super(code);
  }
}

/**
 * Reserves an AI analysis for a draft before calling the model, atomically
 * with a row lock so double clicks can't consume or bypass the allowance.
 */
export async function reserveAnalysis(
  userId: string,
  sessionId: string,
  timezone: string,
) {
  const plan = await getPlan(userId);
  if (await budgetBlocked(plan.pro)) throw new LimitError("budget");
  const period = usagePeriod(timezone);
  return db().transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(learningDraft)
      .where(
        and(
          eq(learningDraft.userId, userId),
          eq(learningDraft.sessionId, sessionId),
        ),
      )
      .for("update");
    if (!draft) throw new LimitError("not_found");
    const [usage] = await tx
      .select({ used: aiUsage.cardsAnalyzed })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), eq(aiUsage.period, period)))
      .for("update");
    const decision = decideAnalysis({
      plan,
      usedThisMonth: usage?.used ?? 0,
      draftCounted: draft.aiCounted,
      draftAnalyses: draft.analysisCount,
    });
    if (!decision.ok) throw new LimitError(decision.reason);
    if (decision.consumesMonthly)
      await tx
        .insert(aiUsage)
        .values({ userId, period, cardsAnalyzed: 1 })
        .onConflictDoUpdate({
          target: [aiUsage.userId, aiUsage.period],
          set: {
            cardsAnalyzed: sql`${aiUsage.cardsAnalyzed} + 1`,
            updatedAt: new Date(),
          },
        });
    await tx
      .update(learningDraft)
      .set({
        aiCounted: true,
        analysisCount: draft.analysisCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(learningDraft.id, draft.id));
    return { draft, plan, period, consumedMonthly: decision.consumesMonthly };
  });
}

/** Gives the reservation back when the AI call failed (the user shouldn't pay for it). */
export async function releaseAnalysis(
  userId: string,
  draftId: string,
  period: string,
  consumedMonthly: boolean,
) {
  await db().transaction(async (tx) => {
    await tx
      .update(learningDraft)
      .set({
        analysisCount: sql`greatest(${learningDraft.analysisCount} - 1, 0)`,
        aiCounted: consumedMonthly ? false : learningDraft.aiCounted,
        updatedAt: new Date(),
      })
      .where(
        and(eq(learningDraft.id, draftId), eq(learningDraft.userId, userId)),
      );
    if (consumedMonthly)
      await tx
        .update(aiUsage)
        .set({ cardsAnalyzed: sql`greatest(${aiUsage.cardsAnalyzed} - 1, 0)` })
        .where(and(eq(aiUsage.userId, userId), eq(aiUsage.period, period)));
  });
}
