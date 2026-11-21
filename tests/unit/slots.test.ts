// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  checkBookable,
  floorToSlot,
  isFreeCancellation,
  isPopularSlot,
  isSlotStart,
  localDayKey,
  nextSlot,
  weekBounds,
  weekGrid,
} from "@/src/lib/scheduling/slots";

const utc = (s: string) => new Date(s);

describe("slots", () => {
  it("only accepts :00 and :30 UTC starts", () => {
    expect(isSlotStart(utc("2026-03-02T14:00:00Z"))).toBe(true);
    expect(isSlotStart(utc("2026-03-02T14:30:00Z"))).toBe(true);
    expect(isSlotStart(utc("2026-03-02T14:15:00Z"))).toBe(false);
    expect(isSlotStart(utc("2026-03-02T14:30:01Z"))).toBe(false);
  });

  it("rounds to slots", () => {
    expect(floorToSlot(utc("2026-03-02T14:44:00Z")).toISOString()).toBe(
      "2026-03-02T14:30:00.000Z",
    );
    expect(nextSlot(utc("2026-03-02T14:30:00Z")).toISOString()).toBe(
      "2026-03-02T15:00:00.000Z",
    );
  });

  it("checks the booking window", () => {
    const now = utc("2026-03-02T14:00:00Z");
    expect(checkBookable(utc("2026-03-02T14:30:00Z"), 50, now)).toEqual({
      ok: true,
    });
    expect(checkBookable(utc("2026-03-02T14:01:00Z"), 50, now)).toMatchObject({
      reason: "not_slot",
    });
    expect(checkBookable(utc("2026-03-02T14:00:00Z"), 50, now)).toMatchObject({
      reason: "too_late",
    });
    expect(checkBookable(utc("2026-03-20T14:00:00Z"), 50, now)).toMatchObject({
      reason: "too_far",
    });
    expect(checkBookable(utc("2026-03-02T15:00:00Z"), 40, now)).toMatchObject({
      reason: "duration",
    });
  });

  it("allows free cancellation until one hour before", () => {
    const start = utc("2026-03-02T15:00:00Z");
    expect(isFreeCancellation(start, utc("2026-03-02T14:00:00Z"))).toBe(true);
    expect(isFreeCancellation(start, utc("2026-03-02T14:00:01Z"))).toBe(false);
  });

  it("computes weeks in the user's zone", () => {
    // Sunday 23:30 in New York is already Monday in UTC.
    const instant = utc("2026-03-09T03:30:00Z");
    const ny = weekBounds(instant, "America/New_York");
    expect(ny.start.toISOString()).toBe("2026-03-02T05:00:00.000Z");
    const tokyo = weekBounds(instant, "Asia/Tokyo");
    expect(tokyo.start.toISOString()).toBe("2026-03-08T15:00:00.000Z");
  });

  it("handles a week that crosses the US DST change", () => {
    // DST starts on Sunday 8 March 2026 in the US.
    const { start, end } = weekBounds(
      utc("2026-03-05T12:00:00Z"),
      "America/Los_Angeles",
    );
    expect(start.toISOString()).toBe("2026-03-02T08:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T07:00:00.000Z");
  });

  it("gives DST days 46 or 50 slots", () => {
    const spring = weekGrid(utc("2026-03-08T12:00:00Z"), "America/New_York", 1);
    expect(spring[0].key).toBe("2026-03-08");
    expect(spring[0].slots).toHaveLength(46);
    const fall = weekGrid(utc("2026-11-01T12:00:00Z"), "America/New_York", 1);
    expect(fall[0].slots).toHaveLength(50);
    const normal = weekGrid(utc("2026-03-10T12:00:00Z"), "America/New_York", 1);
    expect(normal[0].slots).toHaveLength(48);
  });

  it("lays out half-hour offset zones", () => {
    const [day] = weekGrid(utc("2026-03-10T12:00:00Z"), "Asia/Kolkata", 1);
    expect(day.slots).toHaveLength(48);
    expect(localDayKey(day.slots[0], "Asia/Kolkata")).toBe("2026-03-10");
  });

  it("marks US working hours as popular", () => {
    // 11:00 ET / 8:00 PT on a Tuesday: ET, CT, MT working, PT not yet.
    expect(isPopularSlot(utc("2026-03-10T15:00:00Z"))).toBe(true);
    // 13:00 ET Tuesday: all four zones.
    expect(isPopularSlot(utc("2026-03-10T17:00:00Z"))).toBe(true);
    // 3:00 ET: nobody.
    expect(isPopularSlot(utc("2026-03-10T07:00:00Z"))).toBe(false);
    // Saturday midday.
    expect(isPopularSlot(utc("2026-03-14T17:00:00Z"))).toBe(false);
  });
});
