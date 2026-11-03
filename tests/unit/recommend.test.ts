import { describe, expect, it } from "vitest";
import {
  recommendTechnique,
  skipsBreaks,
  type RecommendationSession,
} from "@/src/features/techniques/recommend";
import { computeStreak } from "@/src/features/sessions/streak";

const s = (
  technique: string,
  rating: number | null,
  extra: Partial<RecommendationSession> = {},
): RecommendationSession => ({
  technique,
  rating,
  tags: [],
  focusedSeconds: 1500,
  breakSeconds: 300,
  cyclesCompleted: 1,
  ...extra,
});

describe("technique recommendation", () => {
  it("defaults to Pomodoro without data", () =>
    expect(recommendTechnique({ sessions: [] })).toEqual({
      technique: "pomodoro",
      reason: { key: "default" },
    }));
  it("needs at least three rated sessions before trusting ratings", () => {
    const sessions = [s("52-17", 5), s("52-17", 5)];
    expect(recommendTechnique({ sessions }).technique).toBe("pomodoro");
  });
  it("recommends the best-rated technique for the selected tag", () => {
    const sessions = [
      s("pomodoro", 5),
      s("pomodoro", 5),
      s("pomodoro", 4),
      s("52-17", 5, { tags: ["coding"] }),
      s("52-17", 4, { tags: ["coding"] }),
      s("flowtime", 3, { tags: ["coding"] }),
    ];
    expect(recommendTechnique({ sessions, tag: "coding" })).toEqual({
      technique: "52-17",
      reason: { key: "bestForTag", tag: "coding", rating: 4.5 },
    });
    expect(recommendTechnique({ sessions })).toEqual({
      technique: "pomodoro",
      reason: { key: "bestOverall", rating: 4.7 },
    });
  });
  it("falls back to overall ratings when the tag has too few", () => {
    const sessions = [
      s("flowtime", 4),
      s("flowtime", 4),
      s("pomodoro", 3),
      s("52-17", 5, { tags: ["x"] }),
    ];
    expect(recommendTechnique({ sessions, tag: "x" }).reason.key).toBe(
      "bestOverall",
    );
  });
  it("breaks rating ties by number of sessions", () => {
    const sessions = [s("pomodoro", 4), s("52-17", 4), s("52-17", 4)];
    expect(recommendTechnique({ sessions }).technique).toBe("52-17");
  });
  it("applies the default rules in order", () => {
    expect(
      recommendTechnique({ sessions: [], context: "stuck" }).technique,
    ).toBe("pomodoro");
    expect(
      recommendTechnique({ sessions: [], context: "study" }).reason.key,
    ).toBe("study");
    expect(recommendTechnique({ sessions: [], context: "deep" })).toEqual({
      technique: "52-17",
      reason: { key: "deepShort" },
    });
    const long = [
      s("custom", null, { focusedSeconds: 95 * 60 }),
      s("custom", null, { focusedSeconds: 85 * 60 }),
    ];
    expect(recommendTechnique({ sessions: long, context: "deep" })).toEqual({
      technique: "deep-work-90",
      reason: { key: "deepLong" },
    });
  });
  it("suggests Flowtime to people who skip breaks", () => {
    const skipper = [
      s("pomodoro", null, { breakSeconds: 0, cyclesCompleted: 3 }),
      s("pomodoro", null, { breakSeconds: 10, cyclesCompleted: 2 }),
      s("52-17", null, { breakSeconds: 0 }),
    ];
    expect(skipsBreaks(skipper)).toBe(true);
    expect(recommendTechnique({ sessions: skipper })).toEqual({
      technique: "flowtime",
      reason: { key: "skipsBreaks" },
    });
    expect(
      recommendTechnique({ sessions: skipper, context: "stuck" }).technique,
    ).toBe("pomodoro");
  });
});

describe("streak", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(
      computeStreak(["2026-11-01", "2026-11-02", "2026-11-03"], "2026-11-03"),
    ).toBe(3);
    expect(computeStreak(["2026-11-01", "2026-11-02"], "2026-11-03")).toBe(2);
    expect(computeStreak(["2026-11-01"], "2026-11-03")).toBe(0);
    expect(computeStreak([], "2026-11-03")).toBe(0);
    expect(computeStreak(["2026-12-31", "2027-01-01"], "2027-01-01")).toBe(2);
  });
});

import { bestStreak } from "@/src/features/stats/streaks";
describe("best streak", () => {
  it("finds the longest consecutive run", () => {
    expect(bestStreak([])).toBe(0);
    expect(
      bestStreak([
        "2026-11-01",
        "2026-11-02",
        "2026-11-04",
        "2026-11-05",
        "2026-11-06",
      ]),
    ).toBe(3);
    expect(bestStreak(["2026-12-31", "2027-01-01", "2026-12-30"])).toBe(3);
  });
});
