// SPDX-License-Identifier: AGPL-3.0-only
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
const mocks = vi.hoisted(() => ({ config: vi.fn(), stats: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: keyof typeof messages) =>
    createTranslator({ locale: "en", messages, namespace }),
}));
vi.mock("@/src/config/app", () => ({ getAppConfig: mocks.config }));
vi.mock("@/src/lib/app-user", () => ({
  requireAppUser: async () => ({
    user: { id: "me" },
    profile: { referralCode: "my-code" },
  }),
}));
vi.mock("@/src/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/src/lib/growth/referrals", async (original) => ({
  ...(await original<typeof import("@/src/lib/growth/referrals")>()),
  getReferralStats: mocks.stats,
}));
vi.mock("@/app/[locale]/(app)/invite/invite-share", () => ({
  InviteShare: ({ url }: { url: string }) => (
    <input aria-label="Invite link" value={url} readOnly />
  ),
}));
import { buildReferralLink } from "@/src/lib/growth/referrals";
import Page from "@/app/[locale]/(app)/invite/page";
beforeEach(() => {
  mocks.config.mockReturnValue({
    name: "Study Hall",
    url: "https://study.test/",
    billingEnabled: false,
  });
  mocks.stats.mockResolvedValue({
    totalInvited: 1,
    totalConverted: 0,
    totalRewarded: 0,
    referrals: [{ name: "Alex", status: "pending" }],
  });
});
describe("invite links and honest rewards", () => {
  it.each([
    "https://study.test",
    "https://study.test/",
    "https://study.test/a/base/path",
  ])("builds a root referral redirect for %s", (base) => {
    const link = new URL(buildReferralLink(base, "my-code", "copy_link"));
    expect(link.origin + link.pathname).toBe("https://study.test/r/my-code");
    expect(link.searchParams.get("utm_source")).toBe("copy_link");
  });
  it("uses the real builder on the page and explains the non-billing flow", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("https://study.test/r/my-code?");
    expect(html).toContain("Billing is off");
    expect(html).not.toContain("You both get a month of Plus");
    expect(html).toContain("Alex");
    expect(html).toContain("Signed up");
  });
  it("only promises the existing reward after a completed session when billing is on", async () => {
    mocks.config.mockReturnValue({
      name: "Study Hall",
      url: "https://study.test",
      billingEnabled: true,
    });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("You both get a month of Plus");
    expect(html).toContain("After their first completed session");
    expect(html).not.toContain("Billing is off");
  });
});
