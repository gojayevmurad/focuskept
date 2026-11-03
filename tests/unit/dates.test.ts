import { describe, it, expect } from "vitest";
import {
  addDays,
  diffDays,
  isIsoDate,
  isoWeekKey,
  isValidTimeZone,
  localDate,
  localTime,
  startOfWeek,
  weekdayOf,
  withinWindow,
  zonedParts,
} from "@/src/lib/dates";

describe("calendar dates in a timezone", () => {
  const instant = new Date("2026-11-02T23:30:00Z");
  it("resolves the local date on either side of the date line", () => {
    expect(localDate("UTC", instant)).toBe("2026-11-02");
    expect(localDate("Pacific/Kiritimati", instant)).toBe("2026-11-03"); // UTC+14
    expect(localDate("Pacific/Pago_Pago", instant)).toBe("2026-11-02"); // UTC-11
    expect(localDate("Asia/Baku", instant)).toBe("2026-11-03");
    expect(localTime("Asia/Baku", instant)).toBe("03:30");
  });
  it("handles DST transitions without skipping or repeating a day", () => {
    // Europe/Berlin leaves DST on 2026-10-25 at 03:00 local.
    expect(localDate("Europe/Berlin", new Date("2026-10-24T22:30:00Z"))).toBe(
      "2026-10-25",
    );
    expect(localDate("Europe/Berlin", new Date("2026-10-25T22:30:00Z"))).toBe(
      "2026-10-25",
    );
    expect(localDate("Europe/Berlin", new Date("2026-10-25T23:30:00Z"))).toBe(
      "2026-10-26",
    );
    // US spring-forward day is still exactly one calendar day.
    expect(addDays("2027-03-13", 1)).toBe("2027-03-14");
    expect(addDays("2027-03-14", 1)).toBe("2027-03-15");
    expect(
      zonedParts("America/New_York", new Date("2027-03-14T07:30:00Z")).time,
    ).toBe("03:30");
  });
  it("does calendar arithmetic", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-01-01", "2026-12-31")).toBe(364);
    expect(weekdayOf("2026-11-02")).toBe(1);
    expect(startOfWeek("2026-11-05", 1)).toBe("2026-11-02");
    expect(startOfWeek("2026-11-05", 0)).toBe("2026-11-01");
    expect(startOfWeek("2026-11-01", 1)).toBe("2026-10-26");
  });
  it("computes ISO week keys across year boundaries", () => {
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
    expect(isoWeekKey("2024-12-30")).toBe("2025-W01");
    expect(isoWeekKey("2026-11-02")).toBe("2026-W45");
  });
  it("validates inputs", () => {
    expect(isValidTimeZone("Europe/Istanbul")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
  it("checks notification windows, including ones that cross midnight", () => {
    expect(withinWindow("19:00", "08:00", "21:00")).toBe(true);
    expect(withinWindow("21:00", "08:00", "21:00")).toBe(false);
    expect(withinWindow("23:30", "22:00", "02:00")).toBe(true);
    expect(withinWindow("03:00", "22:00", "02:00")).toBe(false);
  });
});
