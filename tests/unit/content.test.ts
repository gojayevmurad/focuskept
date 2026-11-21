// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, describe, expect, it, vi } from "vitest";
const flags = vi.hoisted(() => ({ marketing: true, billing: false }));
vi.mock("@/src/config/app", () => ({
  getAppConfig: () => ({
    name: 'A "quiet" app',
    url: "https://example.com",
    marketingEnabled: flags.marketing,
    billingEnabled: flags.billing,
  }),
}));
import {
  getSeoPage,
  listSeoPages,
  replaceApp,
  templates,
} from "@/src/lib/content/seo";
import { listBlogPosts, parsePost } from "@/src/lib/content/blog";
import sitemap from "@/app/sitemap";

describe("programmatic content", () => {
  it("loads every template and resolves every page", () => {
    for (const template of templates) {
      const pages = listSeoPages(template);
      expect(pages.length).toBeGreaterThan(0);
      expect(new Set(pages.map((page) => page.slug)).size).toBe(pages.length);
      for (const page of pages) {
        expect(getSeoPage(template, page.slug)).toEqual(page);
        expect(page.sections).toHaveLength(4);
        expect(page.faq).toHaveLength(5);
        expect(JSON.stringify(page)).not.toContain("{app}");
        expect(page.title.length).toBeLessThanOrEqual(70);
        expect(
          page.sections.every((section) => section.heading && section.body),
        ).toBe(true);
      }
    }
    expect(getSeoPage("body-doubling-for", "missing")).toBeUndefined();
  });
  it("replaces nested string values safely without changing data types", () => {
    expect(
      replaceApp(
        { text: "{app} + {app}", nested: ["{app}", 3, null] },
        'A "name"',
      ),
    ).toEqual({ text: 'A "name" + A "name"', nested: ['A "name"', 3, null] });
  });
});

describe("blog content", () => {
  it("parses four substantial original posts in newest-first order", () => {
    const posts = listBlogPosts();
    expect(posts).toHaveLength(4);
    expect(posts.map((post) => post.date)).toEqual(
      posts
        .map((post) => post.date)
        .sort()
        .reverse(),
    );
    for (const post of posts) {
      expect(post.title).toBeTruthy();
      expect(post.description).toBeTruthy();
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(post.date))).toBe(false);
      expect(post.author).toBe('The A "quiet" app team');
      expect(JSON.stringify(post)).not.toContain("{app}");
      const words = post.body.split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(900);
      expect(words).toBeLessThanOrEqual(1300);
      expect(post.html).toContain("<h2>");
    }
  });
  it("escapes raw HTML while retaining Markdown formatting", () => {
    const post = parsePost(
      "---\ntitle: Test\ndescription: Test description\ndate: 2026-11-21\nauthor: The {app} team\n---\n## Heading\n\n<script>alert(1)</script>\n\n**Strong** and <b>raw</b>",
      "test",
    );
    expect(post.html).not.toContain("<script>");
    expect(post.html).not.toContain("<b>");
    expect(post.html).toContain("&lt;script&gt;");
    expect(post.html).toContain("<strong>Strong</strong>");
  });
  it("rejects incomplete frontmatter", () => {
    expect(() => parsePost("No frontmatter", "invalid")).toThrow(
      "Missing frontmatter",
    );
    expect(() => parsePost("---\ntitle: Test\n---\nText", "invalid")).toThrow(
      "Missing description",
    );
  });
});

it("includes all content and excludes disabled billing from the sitemap", () => {
  const urls = sitemap().map((item) => item.url);
  for (const page of listSeoPages())
    expect(urls).toContain(`https://example.com/${page.template}/${page.slug}`);
  for (const post of listBlogPosts())
    expect(urls).toContain(`https://example.com/blog/${post.slug}`);
  expect(urls).toContain("https://example.com/study-with-me/bar-exam");
  expect(urls).not.toContain("https://example.com/pricing");
  expect(new Set(urls).size).toBe(urls.length);
});

it("keeps only legal routes when marketing is disabled", () => {
  flags.marketing = false;
  try {
    expect(sitemap().map((item) => item.url)).toEqual([
      "https://example.com/privacy",
      "https://example.com/terms",
    ]);
  } finally {
    flags.marketing = true;
  }
});

const billing = vi.hoisted(() => ({
  configured: true,
  get: vi.fn(),
}));
vi.mock("@/src/config/env", () => ({
  getEnv: () => ({
    POLAR_ACCESS_TOKEN: billing.configured ? "test-token" : undefined,
    POLAR_ENVIRONMENT: "sandbox",
  }),
}));
vi.mock("@/src/lib/billing/provider", () => ({
  products: () => ({ monthly: "monthly", yearly: "yearly" }),
  polar: () => ({ products: { get: billing.get } }),
}));
afterEach(() => {
  vi.useRealTimers();
  billing.configured = true;
});
describe("Polar prices", () => {
  const product = (interval: string, currency = "usd", amount = 1500) => ({
    is_archived: false,
    is_recurring: true,
    recurring_interval: interval,
    recurring_interval_count: 1,
    prices: [
      {
        is_archived: false,
        amount_type: "fixed",
        price_currency: currency,
        price_amount: amount,
      },
    ],
  });
  it("formats configured prices, shares in-flight work, and refreshes after ten minutes", async () => {
    vi.resetModules();
    billing.get.mockReset();
    vi.useFakeTimers();
    billing.get.mockImplementation(async (id: string) =>
      product(
        id === "monthly" ? "month" : "year",
        "usd",
        id === "monthly" ? 1500 : 12000,
      ),
    );
    const { getPrices } = await import("@/src/lib/content/prices");
    const results = await Promise.all([getPrices(), getPrices()]);
    expect(results).toEqual([
      { monthly: "$15.00", yearly: "$120.00" },
      { monthly: "$15.00", yearly: "$120.00" },
    ]);
    await getPrices();
    expect(billing.get).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    await getPrices();
    expect(billing.get).toHaveBeenCalledTimes(4);
  });
  it("falls back on unconfigured billing and provider errors", async () => {
    vi.resetModules();
    billing.get.mockReset();
    const { getPrices } = await import("@/src/lib/content/prices");
    billing.configured = false;
    expect(await getPrices()).toBeNull();
    expect(billing.get).not.toHaveBeenCalled();
    billing.configured = true;
    billing.get.mockRejectedValue(new Error("Unavailable"));
    expect(await getPrices()).toBeNull();
  });
  it("formats zero-decimal currencies and rejects an unexpected billing interval", async () => {
    vi.resetModules();
    billing.get.mockReset();
    billing.get.mockImplementation(async (id: string) =>
      product(id === "monthly" ? "month" : "year", "jpy", 1500),
    );
    const { getPrices } = await import("@/src/lib/content/prices");
    expect(await getPrices()).toEqual({ monthly: "¥1,500", yearly: "¥1,500" });
    vi.resetModules();
    billing.get.mockResolvedValue(product("month"));
    expect(
      await (await import("@/src/lib/content/prices")).getPrices(),
    ).toBeNull();
  });
});
