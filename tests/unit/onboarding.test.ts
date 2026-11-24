// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAppUser: vi.fn(),
  db: vi.fn(),
  set: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  trackForUser: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/src/lib/app-user", () => ({ requireAppUser: mocks.requireAppUser }));
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

import {
  completeOnboarding,
  saveOnboarding,
} from "@/app/[locale]/(app)/onboarding/actions";
import {
  initialOnboarding,
  type OnboardingProgress,
} from "@/src/lib/profiles/onboarding";

function progress(): OnboardingProgress {
  const initial = initialOnboarding(
    {
      displayName: "Casey",
      timezone: "UTC",
      emailReminders: true,
      emailTips: true,
    },
    null,
  );
  return {
    ...initial,
    step: 8,
    answers: {
      ...initial.answers,
      age: true,
      focusAreas: ["study"],
      blockers: ["starting"],
      preferredTimes: ["morning"],
    },
  };
}

function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  const state = progress();
  state.answers = { ...state.answers, ...extra };
  data.set("progress", JSON.stringify(state));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAppUser.mockResolvedValue({
    user: { id: "member" },
    profile: { onboardedAt: null },
  });
  mocks.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const query = {
    update: () => ({ set: mocks.set }),
    delete: () => ({ where: vi.fn() }),
  };
  mocks.db.mockReturnValue({
    ...query,
    transaction: async (callback: (tx: typeof query) => Promise<unknown>) =>
      callback(query),
  });
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

describe("onboarding persistence and preferences", () => {
  it("saves the exact step and answers for resume, scoped to the signed-in user", async () => {
    const state = progress();
    state.step = 3;
    expect(await saveOnboarding(state)).toEqual({});
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ onboardingState: state }),
    );
    expect(mocks.requireAppUser).toHaveBeenCalledWith(true);
  });
  it("prevents moving beyond an invalid step", async () => {
    const state = progress();
    state.answers.age = false;
    expect(await saveOnboarding(state)).toEqual({ error: "invalid", step: 0 });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("saves meaningful choices and existing notification preferences", async () => {
    const state = progress();
    Object.assign(state.answers, {
      duration: 25,
      microphone: false,
      weeklyGoal: 5,
      reminders: false,
      tips: false,
      marketing: true,
      analytics: true,
    });
    const input = new FormData();
    input.set("progress", JSON.stringify(state));
    await completeOnboarding({}, input);
    expect(mocks.set.mock.calls[0][0]).toMatchObject({
      focusAreas: ["study"],
      blockers: ["starting"],
      preferredTimes: ["morning"],
      defaultDuration: 25,
      microphoneDefault: false,
      weeklyGoal: 5,
      emailReminders: false,
      pushReminders: false,
      emailTips: false,
      emailMarketing: true,
      birthdateConfirmed: true,
      onboardingState: state,
    });
    expect(mocks.set).toHaveBeenCalledWith({ analyticsConsent: true });
  });
  it("returns to a validated deep link on completion", async () => {
    const state = progress();
    state.next = "/book?x=1";
    const input = new FormData();
    input.set("progress", JSON.stringify(state));
    await completeOnboarding({}, input);
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: "/book?x=1",
      locale: "en",
    });
  });
  it("does not overwrite completed onboarding", async () => {
    mocks.requireAppUser.mockResolvedValue({
      user: { id: "member" },
      profile: { onboardedAt: new Date() },
    });
    expect(await saveOnboarding(progress())).toEqual({ error: "invalid" });
    expect(mocks.db).not.toHaveBeenCalled();
  });
});
