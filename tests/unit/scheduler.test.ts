import { describe, expect, it } from "vitest";
import {
  initialSchedule,
  retentionRate,
  scheduleAfterReview,
  type CardSchedule,
} from "@/src/features/reviews/scheduler";
import { addDays, localDate } from "@/src/lib/dates";

const review = (
  card: CardSchedule,
  passed: boolean,
  today: string,
  steps?: number[],
) => {
  const { early: _early, ...next } = scheduleAfterReview(card, {
    passed,
    today,
    steps,
  });
  void _early;
  return next;
};

describe("spaced repetition scheduler", () => {
  it("schedules day 5, 10 and 30 when reviews happen on time", () => {
    const created = "2026-11-02";
    let card = initialSchedule(created);
    expect(card.dueOn).toBe("2026-11-07");
    card = review(card, true, card.dueOn);
    expect(card).toMatchObject({ step: 1, dueOn: addDays(created, 10) });
    card = review(card, true, card.dueOn);
    expect(card).toMatchObject({ step: 2, dueOn: addDays(created, 30) });
  });
  it("graduates to 60 days, then doubles up to 180", () => {
    let card: CardSchedule = {
      step: 2,
      intervalDays: 20,
      dueOn: "2026-12-02",
      relearn: false,
    };
    card = review(card, true, "2026-12-02");
    expect(card).toMatchObject({
      step: 3,
      intervalDays: 60,
      dueOn: "2027-01-31",
    });
    card = review(card, true, card.dueOn);
    expect(card.intervalDays).toBe(120);
    card = review(card, true, card.dueOn);
    expect(card.intervalDays).toBe(180);
    card = review(card, true, card.dueOn);
    expect(card.intervalDays).toBe(180);
  });
  it("returns failed cards in 2 days at the same step, then resumes the ladder", () => {
    let card = initialSchedule("2026-11-02");
    card = review(card, false, "2026-11-07");
    expect(card).toMatchObject({ step: 0, dueOn: "2026-11-09", relearn: true });
    card = review(card, true, "2026-11-09");
    expect(card).toMatchObject({
      step: 1,
      relearn: false,
      dueOn: "2026-11-14",
    });
  });
  it("keeps the graduated interval after a relearn instead of doubling", () => {
    let card: CardSchedule = {
      step: 3,
      intervalDays: 120,
      dueOn: "2027-05-01",
      relearn: false,
    };
    card = review(card, false, "2027-05-01");
    expect(card).toMatchObject({
      step: 3,
      intervalDays: 120,
      dueOn: "2027-05-03",
      relearn: true,
    });
    card = review(card, true, "2027-05-03");
    expect(card).toMatchObject({
      intervalDays: 120,
      relearn: false,
      dueOn: "2027-08-31",
    });
  });
  it("keeps the spacing for overdue cards and treats partial as a miss upstream", () => {
    let card = initialSchedule("2026-11-02");
    card = review(card, true, "2026-11-20");
    expect(card.dueOn).toBe("2026-11-25");
  });
  it("never moves the schedule for early reviews", () => {
    const card = initialSchedule("2026-11-02");
    expect(
      scheduleAfterReview(card, { passed: false, today: "2026-11-03" }),
    ).toEqual({ ...card, early: true });
    expect(
      scheduleAfterReview(card, { passed: true, today: "2026-11-03" }),
    ).toEqual({ ...card, early: true });
  });
  it("supports custom steps", () => {
    let card = initialSchedule("2026-11-02", [1, 3, 7]);
    expect(card.dueOn).toBe("2026-11-03");
    card = review(card, true, card.dueOn, [1, 3, 7]);
    expect(card).toMatchObject({ step: 1, dueOn: "2026-11-05" });
    card = review(card, true, card.dueOn, [1, 3, 7]);
    card = review(card, true, card.dueOn, [1, 3, 7]);
    expect(card).toMatchObject({ step: 3, intervalDays: 60 });
  });
  it("uses the user's local date across timezones and DST", () => {
    const instant = new Date("2026-11-06T23:30:00Z");
    const card = initialSchedule("2026-11-02");
    expect(localDate("Asia/Tokyo", instant) >= card.dueOn).toBe(true);
    expect(localDate("America/Los_Angeles", instant) >= card.dueOn).toBe(false);
    expect(initialSchedule("2027-03-12").dueOn).toBe("2027-03-17");
  });
  it("computes retention", () => {
    expect(retentionRate([])).toBeNull();
    expect(
      retentionRate([
        { passed: true },
        { passed: false },
        { passed: true },
        { passed: true },
      ]),
    ).toBe(0.75);
  });
});
