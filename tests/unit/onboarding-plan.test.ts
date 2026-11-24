// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { initialOnboarding, onboardingDestination, onboardingProgressSchema, computeFocusPlan, validOnboardingStep, firstInvalidStep, selectFocusSlots, timeOfDay, welcomePhase } from "@/src/lib/profiles/onboarding";

const profile = { displayName: "Ada", timezone: "UTC", emailReminders: true, emailTips: true };
const initial = () => initialOnboarding(profile, null);
const ready = () => ({ ...initial().answers, age: true, focusAreas: ["writing"] as const, blockers: ["starting"] as const, preferredTimes: ["morning"] as const });
const valid = () => onboardingProgressSchema.parse({ ...initial(), answers: ready() });

describe("onboarding answers and resume", () => {
  it("restores a serialized server snapshot including destination and optional answers", () => {
    const state = valid(); state.step = 6; state.next = "/book?x=1";
    state.answers.heardFrom = "friend"; state.answers.weeklyGoal = 7;
    expect(initialOnboarding(profile, JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
  it("starts safely when a snapshot is malformed", () => {
    expect(initialOnboarding(profile, { step: 99 }).step).toBe(0);
    expect(initial().answers.marketing).toBe(false);
    expect(initial().answers.age).toBe(false);
  });
  it("requires a name, adult confirmation, focus areas, blockers and a time window", () => {
    const answers = initial().answers;
    expect(firstInvalidStep(answers)).toBe(0);
    answers.age = true;
    expect(firstInvalidStep(answers)).toBe(1);
    answers.focusAreas = ["work"];
    expect(firstInvalidStep(answers)).toBe(2);
    answers.blockers = ["distractions"];
    expect(firstInvalidStep(answers)).toBe(3);
    answers.preferredTimes = ["evening"];
    expect(firstInvalidStep(answers)).toBeUndefined();
    expect(validOnboardingStep(0, { ...answers, displayName: "  " })).toBe(false);
  });
  it("rejects unsupported durations, duplicate choices, invalid zones and out-of-range goals", () => {
    for (const patch of [{ duration: 60 }, { weeklyGoal: 0 }, { weeklyGoal: 11 }, { preferredTimes: ["morning", "morning"] }, { timezone: "Mars/City" }, { focusAreas: ["unknown"] }]) {
      expect(onboardingProgressSchema.safeParse({ ...valid(), answers: { ...valid().answers, ...patch } }).success).toBe(false);
    }
  });
  it("computes the plan from the actual answers", () => {
    expect(computeFocusPlan(valid().answers)).toEqual({ sessions: 3, minutes: 50, area: "writing", times: ["morning"], style: "quiet", support: "starting" });
  });
  it.each(["//evil.test", "https://evil.test", "/onboarding?next=x", "/de/onboarding", "/book/..//evil.test", "/book/../onboarding"])("rejects unsafe or looping destination %s", (path) => {
    expect(onboardingDestination(path)).toBe("/dashboard");
  });
  it("preserves a local deep link and its query while removing the locale prefix", () => {
    expect(onboardingDestination("/fr/book?x=1#calendar")).toBe("/book?x=1#calendar");
  });
});

describe("first-session suggestions", () => {
  const now = new Date("2026-11-24T08:01:00Z");
  const candidates = ["11:30", "09:30", "09:00", "10:00", "16:00", "08:00"].map((time) => ({ startAt: new Date(`2026-11-24T${time}:00Z`), waiting: 0, popular: false }));
  it("returns the next three preferred, bookable times in chronological order", () => {
    expect(selectFocusSlots(candidates, valid().answers, [], now).map((slot) => slot.startAt.toISOString().slice(11,16))).toEqual(["09:00", "09:30", "10:00"]);
  });
  it("uses the selected duration to remove overlaps", () => {
    const existing = [{ startAt: new Date("2026-11-24T10:00:00Z"), durationMin: 50 }];
    expect(selectFocusSlots(candidates, { ...valid().answers, duration: 75 }, existing, now).map((slot) => slot.startAt.toISOString().slice(11,16))).toEqual(["11:30"]);
    expect(selectFocusSlots(candidates, { ...valid().answers, duration: 25 }, existing, now).map((slot) => slot.startAt.toISOString().slice(11,16))).toEqual(["09:00", "09:30", "11:30"]);
  });
  it("evaluates local times across a daylight-saving change and half-hour zones", () => {
    expect(timeOfDay(new Date("2026-03-08T10:30:00Z"), "America/New_York")).toBe("morning");
    expect(timeOfDay(new Date("2026-03-07T10:30:00Z"), "America/New_York")).toBe("night");
    expect(timeOfDay(new Date("2026-11-24T03:00:00Z"), "Asia/Kolkata")).toBe("morning");
  });
});

describe("post-onboarding welcome resume", () => {
  const me = { onboardedAt: new Date(), onboardingState: valid(), welcomeVideoSeenAt: null, tourAnsweredAt: null };
  it("shows the video only after this flow and resumes at the tour question once dismissed", () => {
    expect(welcomePhase(me)).toBe("video");
    expect(welcomePhase({ ...me, welcomeVideoSeenAt: new Date() })).toBe("tour");
    expect(welcomePhase({ ...me, tourAnsweredAt: new Date() })).toBe("done");
    expect(welcomePhase({ ...me, onboardingState: null })).toBe("done");
    expect(welcomePhase({ ...me, onboardedAt: null })).toBe("done");
  });
});
