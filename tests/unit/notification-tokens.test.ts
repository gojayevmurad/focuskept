import { describe, expect, it } from "vitest";
import {
  bearerMatches,
  signUnsubscribe,
  verifyUnsubscribe,
} from "@/src/features/notifications/tokens";

const secret = "a".repeat(64);

describe("unsubscribe tokens", () => {
  it("round-trips user and category", () => {
    const token = signUnsubscribe(secret, "user-1", "reviews");
    expect(verifyUnsubscribe(secret, token)).toEqual({
      userId: "user-1",
      category: "reviews",
    });
  });
  it("rejects tampering, other secrets and unknown categories", () => {
    const token = signUnsubscribe(secret, "user-1", "weekly");
    const [payload, sig] = token.split(".");
    const forged = `${Buffer.from("user-2.weekly").toString("base64url")}.${sig}`;
    expect(verifyUnsubscribe(secret, forged)).toBeNull();
    expect(verifyUnsubscribe("b".repeat(64), token)).toBeNull();
    expect(verifyUnsubscribe(secret, `${payload}.`)).toBeNull();
    expect(verifyUnsubscribe(secret, "garbage")).toBeNull();
    const other = signUnsubscribe(secret, "user-1", "weekly").replace(
      /^[^.]+/,
      Buffer.from("user-1.marketing").toString("base64url"),
    );
    expect(verifyUnsubscribe(secret, other)).toBeNull();
  });
});

describe("cron authorization", () => {
  it("requires the exact bearer secret", () => {
    const cron = "c".repeat(40);
    expect(bearerMatches(`Bearer ${cron}`, cron)).toBe(true);
    expect(bearerMatches(`Bearer ${cron}x`, cron)).toBe(false);
    expect(bearerMatches(cron, cron)).toBe(false);
    expect(bearerMatches(null, cron)).toBe(false);
    expect(bearerMatches(`Bearer ${cron}`, undefined)).toBe(false);
  });
});

import { weeklySuggestion } from "@/src/features/notifications/suggestion";
describe("weekly suggestion", () => {
  const base = {
    focusedMinutes: 600,
    goalMinutes: 600,
    reviews: 5,
    retention: 0.9,
    bestTechnique: "pomodoro",
  };
  it("picks the most important suggestion", () => {
    expect(weeklySuggestion({ ...base, focusedMinutes: 0 })).toEqual({
      key: "start",
    });
    expect(weeklySuggestion({ ...base, retention: 0.5 })).toEqual({
      key: "retention",
      percent: 50,
    });
    expect(weeklySuggestion({ ...base, focusedMinutes: 300 })).toEqual({
      key: "goal",
      percent: 50,
    });
    expect(weeklySuggestion(base)).toEqual({
      key: "bestTechnique",
      technique: "pomodoro",
    });
    expect(weeklySuggestion({ ...base, bestTechnique: null })).toEqual({
      key: "keepGoing",
    });
  });
});
