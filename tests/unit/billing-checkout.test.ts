// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  pendingDiscountCode: vi.fn(),
}));
vi.mock("@/src/config/env", () => ({
  getEnv: () => ({
    APP_URL: "https://focuskept.com",
    BILLING_ENABLED: true,
    POLAR_ACCESS_TOKEN: "test",
  }),
}));
vi.mock("@/src/lib/db", () => ({
  db: () => ({
    insert: () => ({ values: () => ({ onConflictDoNothing: async () => {} }) }),
  }),
}));
vi.mock("@/src/lib/auth/session", () => ({
  getSession: async () => ({
    user: { id: "member", email: "member@example.com", emailVerified: true },
  }),
}));
vi.mock("@/src/lib/security/rate-limit", () => ({
  rateLimit: async () => true,
}));
vi.mock("@/src/lib/billing/provider", () => ({
  products: () => ({ monthly: "plus-monthly" }),
  polar: () => ({
    checkouts: { create: mocks.create },
    discounts: { list: mocks.list },
  }),
}));
vi.mock("@/src/lib/growth/referrals", () => ({
  pendingDiscountCode: mocks.pendingDiscountCode,
}));
vi.mock("@/src/lib/analytics/product", () => ({ trackForUser: vi.fn() }));
import { POST } from "@/app/api/billing/[action]/route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ url: "https://checkout.example/session" });
});

describe("checkout discounts", () => {
  it.each([null, "REFERRAL"])(
    "allows discount codes with referral reward %s",
    async (code) => {
      mocks.pendingDiscountCode.mockResolvedValue(code);
      mocks.list.mockResolvedValue({
        items: [{ code: "REFERRAL", id: "reward-id" }],
      });
      const response = await POST(
        new Request("https://focuskept.com/api/billing/checkout", {
          method: "POST",
          headers: {
            origin: "https://focuskept.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({ plan: "monthly" }),
        }),
        { params: Promise.resolve({ action: "checkout" }) },
      );
      expect(response.status).toBe(200);
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          products: ["plus-monthly"],
          allow_discount_codes: true,
          external_customer_id: "member",
          ...(code ? { discount_id: "reward-id" } : {}),
        }),
      );
      if (!code)
        expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("discount_id");
    },
  );
});
