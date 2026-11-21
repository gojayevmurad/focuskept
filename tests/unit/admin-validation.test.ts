// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  challengeInput,
  licenseInput,
  slugFromTitle,
  utcDate,
} from "@/src/lib/admin/validation";

const challenge = {
  id: "",
  title: "Focus together",
  slug: "focus-together",
  description: "",
  startsAt: "2027-01-01",
  endsAt: "2027-02-01",
  goalType: "sessions",
  goalValue: "10",
};
const groupId = "8bba2632-e4b5-49c3-8716-2d6bacad601b";
describe("admin input validation", () => {
  it("interprets dates as UTC midnight", () => {
    expect(utcDate.parse("2027-01-01").toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
  it("rejects impossible calendar dates", () => {
    expect(utcDate.safeParse("2027-02-29").success).toBe(false);
  });
  it("requires the challenge to end after it starts", () => {
    expect(
      challengeInput.safeParse({ ...challenge, endsAt: challenge.startsAt })
        .success,
    ).toBe(false);
  });
  it("requires whole sessions and positive goals", () => {
    for (const goalValue of ["0", "-1", "2.5", "Infinity"])
      expect(
        challengeInput.safeParse({ ...challenge, goalValue }).success,
      ).toBe(false);
  });
  it("accepts fractional hours that represent whole minutes", () => {
    expect(
      challengeInput.safeParse({
        ...challenge,
        goalType: "minutes",
        goalValue: "1.1",
      }).success,
    ).toBe(true);
  });
  it("rejects fractional minutes", () => {
    expect(
      challengeInput.safeParse({
        ...challenge,
        goalType: "minutes",
        goalValue: "0.001",
      }).success,
    ).toBe(false);
  });
  it("restricts slugs to safe path segments", () => {
    expect(
      challengeInput.safeParse({ ...challenge, slug: "../admin" }).success,
    ).toBe(false);
  });
  it("generates editable slugs from titles", () => {
    expect(slugFromTitle("  Café & Focus!  ")).toBe("cafe-focus");
  });
  it("bounds B2B seats and allows clearing the licence", () => {
    expect(
      licenseInput.parse({ id: groupId, plusSeats: "0", licenseUntil: "" })
        .licenseUntil,
    ).toBeNull();
    expect(
      licenseInput.safeParse({
        id: groupId,
        plusSeats: "10000",
        licenseUntil: "2027-01-01",
      }).success,
    ).toBe(true);
    for (const plusSeats of ["-1", "10001", "1.5"])
      expect(
        licenseInput.safeParse({ id: groupId, plusSeats, licenseUntil: "" })
          .success,
      ).toBe(false);
  });
});
