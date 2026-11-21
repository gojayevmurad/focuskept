import { describe, it, expect } from "vitest";
import {
  safeRedirect,
  credentialsSchema,
  sameOrigin,
} from "@/src/lib/security/validation";
import { envSchema } from "@/src/config/env";
import { activeSubscription, canUsePro } from "@/src/lib/billing/policy";
describe("redirect validation", () => {
  it.each(["//evil.test", "https://evil.test", "/\\evil", "/foo\r\nbar"])(
    "rejects %s",
    (value) => expect(safeRedirect(value)).toBe("/dashboard"),
  );
  it("allows a local path", () =>
    expect(safeRedirect("/settings?tab=profile")).toBe(
      "/settings?tab=profile",
    ));
});
it("rejects cross-origin mutations", () => {
  expect(
    sameOrigin(
      new Request("https://app.test/api", {
        headers: { origin: "https://evil.test" },
      }),
      "https://app.test",
    ),
  ).toBe(false);
  expect(
    sameOrigin(
      new Request("https://app.test/api", {
        headers: { origin: "https://app.test" },
      }),
      "https://app.test",
    ),
  ).toBe(true);
});
it("requires a strong password and valid email", () => {
  expect(
    credentialsSchema.safeParse({ email: "a@b.com", password: "short" })
      .success,
  ).toBe(false);
  expect(
    credentialsSchema.safeParse({ email: "bad", password: "longpassword12345" })
      .success,
  ).toBe(false);
});
it("runs without providers in development", () =>
  expect(envSchema.parse({}).POLAR_ENVIRONMENT).toBe("sandbox"));
it("fails closed on incomplete production config", () =>
  expect(envSchema.safeParse({ NODE_ENV: "production" }).success).toBe(false));
it("requires the benefit and webhook when enabling Polar", () =>
  expect(envSchema.safeParse({ POLAR_ACCESS_TOKEN: "token" }).success).toBe(
    false,
  ));
it("never grants access with an expired lease", () => {
  expect(canUsePro({ pro: true, validUntil: new Date(0) })).toBe(false);
  expect(canUsePro(undefined)).toBe(false);
  expect(
    canUsePro({ pro: false, validUntil: new Date(Date.now() + 60000) }),
  ).toBe(false);
  expect(
    canUsePro({ pro: true, validUntil: new Date(Date.now() + 60000) }),
  ).toBe(true);
});
it.each(["past_due", "unpaid", "canceled", "incomplete", "trialing"])(
  "denies %s subscriptions",
  (status) =>
    expect(
      activeSubscription(
        [{ status, current_period_end: "2099-01-01", product_id: "pro" }],
        ["pro"],
      ),
    ).toBe(false),
);
it("rejects unrecognized products and expired subscriptions", () => {
  expect(
    activeSubscription(
      [
        {
          status: "active",
          current_period_end: "2099-01-01",
          product_id: "other",
        },
      ],
      ["pro"],
    ),
  ).toBe(false);
  expect(
    activeSubscription(
      [
        {
          status: "active",
          current_period_end: "2000-01-01",
          product_id: "pro",
        },
      ],
      ["pro"],
    ),
  ).toBe(false);
});
