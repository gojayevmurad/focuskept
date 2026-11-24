// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
}));

vi.mock("@/src/config/app", () => ({
  getAppConfig: () => ({ url: "https://focuskept.com" }),
}));
vi.mock("@/src/lib/profiles", () => ({
  REFERRAL_COOKIE: "ref",
  getProfileByReferralCode: mocks.profile,
}));

import { GET } from "@/app/r/[code]/route";

const call = (path: string, code: string) =>
  GET(new Request(`https://0.0.0.0:3000${path}`), {
    params: Promise.resolve({ code }),
  });

describe("invite link route", () => {
  beforeEach(() => mocks.profile.mockReset());

  it("redirects to sign-up on the public origin, not the internal host", async () => {
    mocks.profile.mockResolvedValue({ userId: "u1" });
    const response = await call("/r/abcd1234", "abcd1234");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://focuskept.com/sign-up",
    );
    expect(response.headers.get("set-cookie")).toMatch(
      /ref=abcd1234;.*Secure/i,
    );
  });

  it("keeps a safe next path on the public origin", async () => {
    mocks.profile.mockResolvedValue({ userId: "u1" });
    const response = await call("/r/abcd1234?next=/book", "abcd1234");
    expect(response.headers.get("location")).toBe("https://focuskept.com/book");
  });

  it("does not set a cookie for an unknown code", async () => {
    mocks.profile.mockResolvedValue(undefined);
    const response = await call("/r/nope1234", "nope1234");
    expect(response.headers.get("location")).toBe(
      "https://focuskept.com/sign-up",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
