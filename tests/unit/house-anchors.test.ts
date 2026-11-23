// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { expandAnchorSlots } from "@/src/lib/bookings/anchors";

const iso = (slots: Date[]) => slots.map((slot) => slot.toISOString());

describe("expandAnchorSlots", () => {
  it("expands every time on both inclusive UTC endpoints", () => {
    expect(
      iso(
        expandAnchorSlots({
          from: "2026-11-23",
          to: "2026-11-24",
          times: ["09:00", "16:30"],
        }),
      ),
    ).toEqual([
      "2026-11-23T09:00:00.000Z",
      "2026-11-23T16:30:00.000Z",
      "2026-11-24T09:00:00.000Z",
      "2026-11-24T16:30:00.000Z",
    ]);
  });

  it("defaults to Monday through Friday", () => {
    expect(
      iso(
        expandAnchorSlots({
          from: "2026-11-20",
          to: "2026-11-23",
          times: ["09:00"],
        }),
      ),
    ).toEqual(["2026-11-20T09:00:00.000Z", "2026-11-23T09:00:00.000Z"]);
  });

  it("filters explicit weekdays, including weekends", () => {
    expect(
      iso(
        expandAnchorSlots({
          from: "2026-11-20",
          to: "2026-11-24",
          times: ["12:00"],
          weekdays: ["sun", "tue"],
        }),
      ),
    ).toEqual(["2026-11-22T12:00:00.000Z", "2026-11-24T12:00:00.000Z"]);
  });

  it("supports a single-day range and deduplicates/sorts times", () => {
    expect(
      iso(
        expandAnchorSlots({
          from: "2026-11-23",
          to: "2026-11-23",
          times: ["23:30", "00:00", "23:30"],
          weekdays: ["mon", "mon"],
        }),
      ),
    ).toEqual(["2026-11-23T00:00:00.000Z", "2026-11-23T23:30:00.000Z"]);
  });

  it("keeps UTC dates and times across DST and month boundaries", () => {
    expect(
      iso(
        expandAnchorSlots({
          from: "2026-10-31",
          to: "2026-11-02",
          times: ["00:00", "23:30"],
          weekdays: ["sat", "sun", "mon"],
        }),
      ),
    ).toEqual([
      "2026-10-31T00:00:00.000Z",
      "2026-10-31T23:30:00.000Z",
      "2026-11-01T00:00:00.000Z",
      "2026-11-01T23:30:00.000Z",
      "2026-11-02T00:00:00.000Z",
      "2026-11-02T23:30:00.000Z",
    ]);
  });

  it("includes leap days and crosses year boundaries", () => {
    expect(
      iso(
        expandAnchorSlots({
          from: "2028-02-28",
          to: "2028-03-01",
          times: ["09:00"],
        }),
      ),
    ).toEqual([
      "2028-02-28T09:00:00.000Z",
      "2028-02-29T09:00:00.000Z",
      "2028-03-01T09:00:00.000Z",
    ]);
    expect(
      iso(
        expandAnchorSlots({
          from: "2026-12-31",
          to: "2027-01-01",
          times: ["00:00"],
        }),
      ),
    ).toEqual(["2026-12-31T00:00:00.000Z", "2027-01-01T00:00:00.000Z"]);
  });

  it("returns no slots when weekdays do not match", () => {
    expect(
      expandAnchorSlots({
        from: "2026-11-21",
        to: "2026-11-22",
        times: ["09:00"],
      }),
    ).toEqual([]);
  });

  it.each(["2026-02-29", "2026-11-31", "2026-13-01", "2026-1-01", "invalid"])(
    "rejects invalid dates instead of normalizing %s",
    (from) => {
      expect(() =>
        expandAnchorSlots({ from, to: "2026-12-31", times: ["09:00"] }),
      ).toThrow("Invalid UTC date");
      expect(() =>
        expandAnchorSlots({ from: "2026-01-01", to: from, times: ["09:00"] }),
      ).toThrow("Invalid UTC date");
    },
  );

  it.each(["24:00", "12:60", "9:00", "09:00:00", "", "-1:00"])(
    "rejects invalid time %s",
    (time) => {
      expect(() =>
        expandAnchorSlots({
          from: "2026-11-23",
          to: "2026-11-23",
          times: [time],
        }),
      ).toThrow("Invalid UTC time");
    },
  );

  it("rejects reversed ranges and empty times", () => {
    expect(() =>
      expandAnchorSlots({
        from: "2026-11-24",
        to: "2026-11-23",
        times: ["09:00"],
      }),
    ).toThrow("--from must be on or before --to");
    expect(() =>
      expandAnchorSlots({
        from: "2026-11-23",
        to: "2026-11-23",
        times: [],
      }),
    ).toThrow("At least one UTC time");
  });
});
