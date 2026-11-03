// Plan limits. Pure functions: unit-tested, shared by server and UI.
export const FREE_CARD_LIMIT = 20;
export const FREE_MONTHLY_AI_CARDS = 10;
/** Free users may revise and re-analyse once per card (Pro: unlimited). */
export const FREE_ANALYSES_PER_CARD = 2;
export const DAILY_GRADING_LIMIT = 100;
export const AI_REQUESTS_PER_MINUTE = 10;
/** Free users lose AI first, once this share of the daily token budget is used. */
export const FREE_BUDGET_SHARE = 0.8;

export type Plan = { pro: boolean; proMonthlyAiCards: number };

export function monthlyAiLimit(plan: Plan) {
  return plan.pro ? plan.proMonthlyAiCards : FREE_MONTHLY_AI_CARDS;
}

export function cardLimit(plan: Plan) {
  return plan.pro ? Infinity : FREE_CARD_LIMIT;
}

export type AnalysisDecision =
  | { ok: true; consumesMonthly: boolean }
  | { ok: false; reason: "monthly_limit" | "reanalysis_limit" };

/**
 * An analysis, its questions and one re-analysis count as one card. The
 * monthly allowance is consumed only by the first analysis of a draft.
 */
export function decideAnalysis(input: {
  plan: Plan;
  usedThisMonth: number;
  draftCounted: boolean;
  draftAnalyses: number;
}): AnalysisDecision {
  if (input.draftCounted) {
    if (!input.plan.pro && input.draftAnalyses >= FREE_ANALYSES_PER_CARD)
      return { ok: false, reason: "reanalysis_limit" };
    return { ok: true, consumesMonthly: false };
  }
  if (input.usedThisMonth >= monthlyAiLimit(input.plan))
    return { ok: false, reason: "monthly_limit" };
  return { ok: true, consumesMonthly: true };
}

export type BudgetState = "ok" | "free_blocked" | "all_blocked";

export function budgetState(
  usedTokens: number,
  budget: number | undefined,
): BudgetState {
  if (!budget) return "ok";
  if (usedTokens >= budget) return "all_blocked";
  if (usedTokens >= budget * FREE_BUDGET_SHARE) return "free_blocked";
  return "ok";
}

export function aiBlockedByBudget(state: BudgetState, pro: boolean) {
  return state === "all_blocked" || (state === "free_blocked" && !pro);
}
