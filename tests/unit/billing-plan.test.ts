// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  db: vi.fn(),
  hasEntitlement: vi.fn(),
}));
vi.mock("@/src/config/env", () => ({ getEnv: mocks.getEnv }));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("@/src/lib/billing/entitlements", () => ({
  hasEntitlement: mocks.hasEntitlement,
}));
import { getPlan } from "@/src/lib/billing/plan";
import { user } from "@/src/lib/db/schema";

const dates = {
  FOUNDING_SIGNUP_BEFORE: "2027-02-01T00:00:00Z",
  FOUNDING_PLUS_UNTIL: "2027-05-01T00:00:00Z",
};
let signedUp: Date;
const from = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-03-01T00:00:00Z"));
  signedUp = new Date("2027-01-01T00:00:00Z");
  mocks.getEnv.mockReturnValue({ BILLING_ENABLED: true, ...dates });
  mocks.hasEntitlement.mockResolvedValue(false);
  from.mockImplementation((table) => {
    const rows = table === user ? [{ createdAt: signedUp }] : [];
    return {
      where: () => Object.assign(Promise.resolve(rows), { limit: () => rows }),
      innerJoin: () => ({ where: () => ({ limit: () => [] }) }),
    };
  });
  mocks.db.mockReturnValue({ select: () => ({ from }) });
});
afterEach(() => vi.useRealTimers());

describe("founding Plus", () => {
  it.each([
    {},
    { FOUNDING_SIGNUP_BEFORE: dates.FOUNDING_SIGNUP_BEFORE },
    { FOUNDING_PLUS_UNTIL: dates.FOUNDING_PLUS_UNTIL },
  ])(
    "uses the normal free plan when one or both dates are unset: %j",
    async (configured) => {
      mocks.getEnv.mockReturnValue({ BILLING_ENABLED: true, ...configured });
      expect(await getPlan("member")).toEqual({ plan: "free", reason: "none" });
      expect(from).not.toHaveBeenCalledWith(user);
    },
  );

  it.each(["2027-02-01T00:00:00Z", "2027-02-02T00:00:00Z"])(
    "does not grant the perk to signups at or after the cutoff: %s",
    async (date) => {
      signedUp = new Date(date);
      expect(await getPlan("member")).toEqual({ plan: "free", reason: "none" });
    },
  );

  it.each(["2027-05-01T00:00:00Z", "2027-06-01T00:00:00Z"])(
    "ends the perk at the expiry: %s",
    async (date) => {
      vi.setSystemTime(new Date(date));
      expect(await getPlan("member")).toEqual({ plan: "free", reason: "none" });
    },
  );

  it("grants Plus to an early member while the perk is active", async () => {
    expect(await getPlan("member")).toEqual({
      plan: "plus",
      reason: "founding",
    });
    expect(from).toHaveBeenCalledWith(user);
    expect(mocks.hasEntitlement).not.toHaveBeenCalled();
  });

  it("keeps early access free regardless of the founding dates", async () => {
    mocks.getEnv.mockReturnValue({ BILLING_ENABLED: false });
    expect(await getPlan("member")).toEqual({
      plan: "plus",
      reason: "billing_disabled",
    });
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it("still grants subscribed members Plus after the perk expires", async () => {
    vi.setSystemTime(new Date("2027-06-01T00:00:00Z"));
    mocks.hasEntitlement.mockResolvedValue(true);
    expect(await getPlan("member")).toEqual({
      plan: "plus",
      reason: "subscription",
    });
  });
});
