// SPDX-License-Identifier: AGPL-3.0-only
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
const mocks = vi.hoisted(() => ({
  membership: vi.fn(),
  community: vi.fn(),
  auth: vi.fn(),
  members: vi.fn(),
  sessions: vi.fn(),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: keyof typeof messages) =>
    createTranslator({ locale: "en", messages, namespace }),
  getFormatter: async () => ({ dateTime: () => "24 Nov" }),
}));
vi.mock("@/src/lib/app-user", () => ({ requireAppUser: mocks.auth }));
vi.mock("@/src/lib/community", () => ({
  getCommunity: mocks.community,
  membership: mocks.membership,
  members: mocks.members,
}));
vi.mock("@/src/lib/community/feed", () => ({
  postSessionOptions: async () => [],
}));
vi.mock("@/src/lib/db", () => ({
  db: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: mocks.sessions }) }),
      }),
    }),
  }),
}));
vi.mock("@/src/config/app", () => ({
  getAppConfig: () => ({ url: "https://study.test" }),
}));
vi.mock("@/src/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/src/components/copy-link", () => ({
  CopyLink: ({ value }: { value: string }) => <input readOnly value={value} />,
}));
vi.mock("@/src/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/app/[locale]/(app)/groups/forms", () => ({
  MemberActions: ({ kind }: { kind: string }) => <button>{kind}</button>,
}));
vi.mock("@/app/[locale]/(app)/groups/feed-controls", () => ({
  Composer: () => <div>Composer</div>,
}));
vi.mock("@/app/[locale]/(app)/groups/feed", () => ({
  Feed: ({ groupId }: { groupId: string }) => (
    <section data-circle={groupId}>Filtered feed</section>
  ),
}));
vi.mock("@/app/[locale]/(app)/hosting/forms", () => ({
  JoinHosted: () => <button>Join session</button>,
}));
import Page from "@/app/[locale]/(app)/groups/[slug]/page";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "me" },
    profile: { timezone: "UTC", shareWinsAutomatically: false },
  });
  mocks.community.mockResolvedValue({
    id: "circle-id",
    name: "Writers",
    slug: "writers",
    description: "Make time to write",
    joinCode: "invite-123",
    plusSeats: 0,
  });
  mocks.membership.mockResolvedValue({ role: "member" });
  mocks.members.mockResolvedValue([
    { userId: "me", name: "Alex", username: "alex", role: "member" },
  ]);
  mocks.sessions.mockResolvedValue([]);
});
const render = async () =>
  renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ slug: "writers" }),
      searchParams: Promise.resolve({}),
    }),
  );
describe("circle navigation", () => {
  it("renders a clear Community / Circle breadcrumb and a member-filtered feed", async () => {
    const html = await render();
    expect(html).toContain('href="/groups">Community</a>');
    expect(html).toContain('aria-current="page">Writers');
    expect(html).toContain('data-circle="circle-id"');
    expect(html).toContain("leave");
    expect(html).toContain("Composer");
    expect(html).toContain("https://study.test/groups/join/invite-123");
  });
  it("lets a non-member discover a circle and join before posting", async () => {
    mocks.membership.mockResolvedValue(undefined);
    const html = await render();
    expect(html).toContain(">join</button>");
    expect(html).not.toContain("Composer");
    expect(html).not.toContain("invite-123");
    expect(html).toContain("Filtered feed");
  });
});
