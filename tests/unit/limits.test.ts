import { describe, expect, it } from "vitest";
import {
  aiBlockedByBudget,
  budgetState,
  cardLimit,
  decideAnalysis,
  FREE_CARD_LIMIT,
  monthlyAiLimit,
} from "@/src/features/limits/rules";

const free = { pro: false, proMonthlyAiCards: 300 };
const pro = { pro: true, proMonthlyAiCards: 300 };

describe("plan limits", () => {
  it("caps Free at 20 cards and 10 analyses; Pro uses the fair-use cap", () => {
    expect(cardLimit(free)).toBe(FREE_CARD_LIMIT);
    expect(cardLimit(pro)).toBe(Infinity);
    expect(monthlyAiLimit(free)).toBe(10);
    expect(monthlyAiLimit(pro)).toBe(300);
  });
  it("counts analysis + questions + one re-analysis as one card", () => {
    expect(
      decideAnalysis({
        plan: free,
        usedThisMonth: 3,
        draftCounted: false,
        draftAnalyses: 0,
      }),
    ).toEqual({ ok: true, consumesMonthly: true });
    expect(
      decideAnalysis({
        plan: free,
        usedThisMonth: 4,
        draftCounted: true,
        draftAnalyses: 1,
      }),
    ).toEqual({ ok: true, consumesMonthly: false });
    expect(
      decideAnalysis({
        plan: free,
        usedThisMonth: 4,
        draftCounted: true,
        draftAnalyses: 2,
      }),
    ).toEqual({ ok: false, reason: "reanalysis_limit" });
    expect(
      decideAnalysis({
        plan: pro,
        usedThisMonth: 4,
        draftCounted: true,
        draftAnalyses: 9,
      }),
    ).toEqual({ ok: true, consumesMonthly: false });
  });
  it("blocks new analyses at the monthly limit but never re-analysis of a counted card", () => {
    expect(
      decideAnalysis({
        plan: free,
        usedThisMonth: 10,
        draftCounted: false,
        draftAnalyses: 0,
      }),
    ).toEqual({ ok: false, reason: "monthly_limit" });
    expect(
      decideAnalysis({
        plan: free,
        usedThisMonth: 10,
        draftCounted: true,
        draftAnalyses: 1,
      }).ok,
    ).toBe(true);
    expect(
      decideAnalysis({
        plan: pro,
        usedThisMonth: 300,
        draftCounted: false,
        draftAnalyses: 0,
      }).ok,
    ).toBe(false);
  });
  it("disables AI for Free users first when the daily budget runs low", () => {
    expect(budgetState(100, undefined)).toBe("ok");
    expect(budgetState(799, 1000)).toBe("ok");
    expect(budgetState(800, 1000)).toBe("free_blocked");
    expect(budgetState(1000, 1000)).toBe("all_blocked");
    expect(aiBlockedByBudget("free_blocked", false)).toBe(true);
    expect(aiBlockedByBudget("free_blocked", true)).toBe(false);
    expect(aiBlockedByBudget("all_blocked", true)).toBe(true);
  });
});
