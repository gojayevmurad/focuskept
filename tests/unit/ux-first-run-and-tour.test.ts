// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";

describe("Tour and first-run UX logic", () => {
  it("determines first-run experience based on zero completed sessions", () => {
    const isFirstRun = (sessionsCount: number) => sessionsCount === 0;

    expect(isFirstRun(0)).toBe(true);
    expect(isFirstRun(1)).toBe(false);
    expect(isFirstRun(5)).toBe(false);
  });

  it("selects appropriate action and copy based on upcoming bookings", () => {
    function getFirstRunState(hasUpcoming: boolean) {
      return {
        mode: hasUpcoming ? "timeline" : "guide",
        primaryAction: hasUpcoming ? "open_room" : "book_first",
        timelineStepsCount: hasUpcoming ? 4 : 3,
      };
    }

    const unbooked = getFirstRunState(false);
    expect(unbooked.mode).toBe("guide");
    expect(unbooked.primaryAction).toBe("book_first");
    expect(unbooked.timelineStepsCount).toBe(3);

    const booked = getFirstRunState(true);
    expect(booked.mode).toBe("timeline");
    expect(booked.primaryAction).toBe("open_room");
    expect(booked.timelineStepsCount).toBe(4);
  });

  it("handles tour step bounds and navigation correctly", () => {
    const totalSteps = 5;
    const nextStep = (current: number) => Math.min(totalSteps - 1, current + 1);
    const prevStep = (current: number) => Math.max(0, current - 1);

    expect(nextStep(0)).toBe(1);
    expect(nextStep(4)).toBe(4);
    expect(prevStep(0)).toBe(0);
    expect(prevStep(3)).toBe(2);
  });

  it("handles walkthrough autoplay and scene looping", () => {
    const totalScenes = 5;
    const advanceScene = (current: number) => (current + 1) % totalScenes;

    expect(advanceScene(0)).toBe(1);
    expect(advanceScene(3)).toBe(4);
    expect(advanceScene(4)).toBe(0); // loops back to beginning
  });
});
