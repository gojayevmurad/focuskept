// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { matchRate } from "@/src/lib/admin/metrics";

describe("admin match rate", () => {
  it("returns zero for an empty period", () => {
    expect(matchRate(0, 0)).toBe(0);
  });
  it("counts successful bookings against successes plus failures", () => {
    expect(matchRate(8, 2)).toBe(0.8);
  });
  it("returns one when every booking matched", () => {
    expect(matchRate(17, 0)).toBe(1);
  });
  it("returns zero when every attempt failed", () => {
    expect(matchRate(0, 5)).toBe(0);
  });
});
