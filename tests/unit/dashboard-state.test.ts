// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  dashboardState,
  type HeroBooking,
} from "@/app/[locale]/(app)/dashboard/state";
const now = Date.parse("2026-11-24T10:00:00Z");
const booked = (offset: number, id = "booking"): HeroBooking => ({
  id,
  startAt: new Date(now + offset * 60000).toISOString(),
  durationMin: 25,
  sessionId: "room",
  partner: null,
});
describe("dashboard session states", () => {
  it("shows empty only when there is no unexpired booking", () => {
    expect(dashboardState([], 0, now).mode).toBe("none");
    expect(dashboardState([booked(-25)], 1, now).mode).toBe("none");
  });
  it("shows the next booking before the ten-minute join window", () => {
    expect(
      dashboardState([booked(60, "later"), booked(11, "next")], 0, now),
    ).toMatchObject({ mode: "upcoming", booking: { id: "next" } });
  });
  it("counts down within ten minutes, including unmatched bookings", () => {
    expect(
      dashboardState([{ ...booked(10), sessionId: null }], 0, now).mode,
    ).toBe("soon");
  });
  it("prioritizes a live session and advances after its end", () => {
    const bookings = [booked(60, "next"), booked(-5, "live")];
    expect(dashboardState(bookings, 1, now)).toMatchObject({
      mode: "live",
      booking: { id: "live" },
    });
    expect(dashboardState(bookings, 1, now + 25 * 60000)).toMatchObject({
      mode: "upcoming",
      booking: { id: "next" },
    });
  });
  it("hides the explainer permanently after the first completed session, with or without a booking", () => {
    for (const bookings of [[], [booked(60)]]) {
      expect(dashboardState(bookings, 0, now).showExplainer).toBe(true);
      expect(dashboardState(bookings, 1, now).showExplainer).toBe(false);
    }
  });
});
