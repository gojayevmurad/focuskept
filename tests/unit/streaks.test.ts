import { describe, expect, it } from "vitest";
import { dailyStreak, longestDailyStreak, weeklyStreak } from "@/src/lib/growth/streaks";

const d = (s: string) => new Date(s);

describe("streaks", () => {
  it("counts consecutive local days ending today or yesterday", () => {
    const now = d("2026-03-12T15:00:00Z");
    const starts = [d("2026-03-10T14:00:00Z"), d("2026-03-11T14:00:00Z"), d("2026-03-12T13:00:00Z")];
    expect(dailyStreak(starts, "America/New_York", now)).toBe(3);
    // No session yet today: yesterday's streak still counts.
    expect(dailyStreak(starts.slice(0, 2), "America/New_York", now)).toBe(2);
    // A gap breaks it.
    expect(dailyStreak([d("2026-03-09T14:00:00Z")], "America/New_York", now)).toBe(0);
  });

  it("uses the user's day boundaries", () => {
    // 03:30 UTC on the 11th is still the 10th in Los Angeles.
    const starts = [d("2026-03-10T18:00:00Z"), d("2026-03-11T03:30:00Z")];
    expect(dailyStreak(starts, "America/Los_Angeles", d("2026-03-11T05:00:00Z"))).toBe(1);
    expect(dailyStreak(starts, "UTC", d("2026-03-11T05:00:00Z"))).toBe(2);
  });

  it("survives the DST change", () => {
    const starts = [d("2026-03-07T15:00:00Z"), d("2026-03-08T15:00:00Z"), d("2026-03-09T15:00:00Z")];
    expect(dailyStreak(starts, "America/New_York", d("2026-03-09T20:00:00Z"))).toBe(3);
  });

  it("counts weeks", () => {
    const starts = [d("2026-02-24T15:00:00Z"), d("2026-03-03T15:00:00Z"), d("2026-03-10T15:00:00Z")];
    expect(weeklyStreak(starts, "America/New_York", d("2026-03-12T15:00:00Z"))).toBe(3);
    expect(weeklyStreak(starts.slice(0, 2), "America/New_York", d("2026-03-12T15:00:00Z"))).toBe(2);
  });

  it("finds the longest run", () => {
    const starts = ["01", "02", "03", "05", "06"].map((x) => d(`2026-03-${x}T15:00:00Z`));
    expect(longestDailyStreak(starts, "UTC")).toBe(3);
  });
});
