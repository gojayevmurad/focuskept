// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAppUser: vi.fn(),
  isUsernameTaken: vi.fn(),
  db: vi.fn(),
  set: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  trackForUser: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/src/lib/app-user", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("@/src/lib/profiles", () => ({
  isUsernameTaken: mocks.isUsernameTaken,
}));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete }),
}));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }));
vi.mock("@/src/lib/analytics/product", () => ({
  trackForUser: mocks.trackForUser,
}));
vi.mock("@/src/i18n/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/src/lib/bookings/service", () => ({
  BookingFailure: class extends Error {},
  createBooking: vi.fn(),
}));

import { completeOnboarding } from "@/app/[locale]/(app)/onboarding/actions";

function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    displayName: "Casey",
    username: "casey",
    timezone: "UTC",
    age: "on",
    ...extra,
  }))
    data.set(key, value);
  data.append("segments", "study");
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAppUser.mockResolvedValue({ user: { id: "member" } });
  mocks.isUsernameTaken.mockResolvedValue(false);
  mocks.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mocks.db.mockReturnValue({ update: () => ({ set: mocks.set }) });
  mocks.cookieGet.mockReturnValue({
    value: JSON.stringify({
      source: "newsletter",
      medium: "email",
      campaign: "launch",
      landingPath: "/join",
      firstSeenAt: "2026-11-23T12:00:00Z",
    }),
  });
});

describe("onboarding attribution storage and analytics", () => {
  it.each([
    "tiktok",
    "instagram",
    "youtube",
    "reddit",
    "google",
    "friend",
    "podcast",
    "other",
  ])("stores and tracks %s without sending free text", async (heardFrom) => {
    await completeOnboarding(
      {},
      form({ heardFrom, heardFromOther: "  Private newsletter details  " }),
    );
    const attribution = mocks.set.mock.calls[0][0].attribution;
    expect(attribution).toEqual({
      source: "newsletter",
      medium: "email",
      campaign: "launch",
      landingPath: "/join",
      firstSeenAt: "2026-11-23T12:00:00Z",
      heardFrom,
      ...(heardFrom === "other"
        ? { heardFromOther: "Private newsletter details" }
        : {}),
    });
    expect(mocks.trackForUser).toHaveBeenCalledWith(
      "member",
      "onboarding_completed",
      {
        segments: 1,
        channel: "referral",
        heard_from: heardFrom,
        $set_once: {
          initial_channel: "referral",
          initial_source: "newsletter",
          initial_medium: "email",
          initial_campaign: "launch",
          initial_referrer: undefined,
          initial_landing_path: "/join",
          heard_from: heardFrom,
        },
      },
    );
    const payload = JSON.stringify(mocks.trackForUser.mock.calls);
    expect(payload).not.toContain("Private newsletter details");
    expect(payload).not.toContain("heardFromOther");
    expect(payload).not.toContain("heard_from_other");
    expect(mocks.cookieDelete).toHaveBeenCalledWith("fk_attr");
  });

  it("completes onboarding when the question is skipped", async () => {
    await completeOnboarding({}, form());
    expect(mocks.set.mock.calls[0][0].attribution).not.toHaveProperty(
      "heardFrom",
    );
    const payload = JSON.stringify(mocks.trackForUser.mock.calls);
    expect(payload).not.toContain("heard_from");
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: "/dashboard?welcome=1",
      locale: "en",
    });
  });

  it("stores an answer even without a first-touch cookie", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    await completeOnboarding({}, form({ heardFrom: "friend" }));
    expect(mocks.set.mock.calls[0][0].attribution).toEqual({
      heardFrom: "friend",
    });
  });

  it("rejects an unknown source before saving or tracking", async () => {
    expect(
      await completeOnboarding({}, form({ heardFrom: "unknown" })),
    ).toEqual({ error: "invalid" });
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.trackForUser).not.toHaveBeenCalled();
  });
});
