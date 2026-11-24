// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { envSchema } from "@/src/config/env";
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  auth: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("404");
  }),
}));
vi.mock("@/src/config/app", () => ({ getAppConfig: mocks.config }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/src/lib/app-user", () => ({ requireAppUser: mocks.auth }));
import { requireChallenges } from "@/src/lib/challenges/gate";
import { toggleChallenge } from "@/app/[locale]/(app)/challenges/actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockReturnValue({ challengesEnabled: false });
});
describe("optional challenges", () => {
  it("defaults off and validates a strict boolean environment flag", () => {
    expect(envSchema.parse({}).CHALLENGES_ENABLED).toBe(false);
    expect(envSchema.parse({ CHALLENGES_ENABLED: "" }).CHALLENGES_ENABLED).toBe(
      false,
    );
    expect(
      envSchema.parse({ CHALLENGES_ENABLED: "true" }).CHALLENGES_ENABLED,
    ).toBe(true);
    expect(
      envSchema.parse({ CHALLENGES_ENABLED: "false" }).CHALLENGES_ENABLED,
    ).toBe(false);
    for (const value of ["yes", "typo", "1", "TRUE"])
      expect(envSchema.safeParse({ CHALLENGES_ENABLED: value }).success).toBe(
        false,
      );
  });
  it("returns notFound while disabled and permits rendering when enabled", () => {
    expect(() => requireChallenges()).toThrow("404");
    mocks.config.mockReturnValue({ challengesEnabled: true });
    expect(() => requireChallenges()).not.toThrow();
  });
  it("also closes the user mutation endpoint while disabled", async () => {
    await expect(
      toggleChallenge("00000000-0000-4000-8000-000000000001", true),
    ).rejects.toThrow("404");
    expect(mocks.auth).not.toHaveBeenCalled();
  });
});
