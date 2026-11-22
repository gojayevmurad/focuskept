// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("robots.txt Configuration", () => {
  it("allows search discovery and AI answer crawlers on public pages", () => {
    const config = robots();
    expect(config.sitemap).toContain("/sitemap.xml");

    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const allowedRule = rules.find(
      (r) =>
        Array.isArray(r.userAgent) &&
        r.userAgent.includes("Googlebot") &&
        r.userAgent.includes("PerplexityBot") &&
        r.userAgent.includes("ClaudeBot"),
    );

    expect(allowedRule).toBeDefined();
    expect(allowedRule?.allow).toBe("/");

    // Verify key crawlers are explicitly covered
    const userAgents = allowedRule?.userAgent as string[];
    expect(userAgents).toContain("*");
    expect(userAgents).toContain("Googlebot");
    expect(userAgents).toContain("Bingbot");
    expect(userAgents).toContain("OAI-SearchBot");
    expect(userAgents).toContain("ChatGPT-User");
    expect(userAgents).toContain("PerplexityBot");
    expect(userAgents).toContain("Perplexity-User");
    expect(userAgents).toContain("ClaudeBot");
    expect(userAgents).toContain("Claude-User");
    expect(userAgents).toContain("Claude-SearchBot");
    expect(userAgents).toContain("Applebot");
    expect(userAgents).toContain("DuckDuckBot");
    expect(userAgents).toContain("GPTBot");
    expect(userAgents).toContain("Google-Extended");
  });

  it("disallows private and authenticated areas across all locales", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const generalRule = rules[0];
    const disallow = Array.isArray(generalRule.disallow)
      ? generalRule.disallow
      : [generalRule.disallow];

    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/dashboard");
    expect(disallow).toContain("/book");
    expect(disallow).toContain("/session");
    expect(disallow).toContain("/settings");
    expect(disallow).toContain("/admin");
    expect(disallow).toContain("/onboarding");
    expect(disallow).toContain("/sign-in");
    expect(disallow).toContain("/sign-up");

    // Localized disallows
    expect(disallow).toContain("/de/dashboard");
    expect(disallow).toContain("/fr/admin");
    expect(disallow).toContain("/nl/settings");
    expect(disallow).toContain("/es/book");
  });

  it("disallows bulk model training scraper CCBot", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const ccRule = rules.find((r) => r.userAgent === "CCBot");
    expect(ccRule).toBeDefined();
    expect(ccRule?.disallow).toBe("/");
  });
});

describe("sitemap.xml Configuration", () => {
  it("includes all public pages in all locales with lastmod and x-default", () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(20);

    for (const entry of entries) {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.lastModified).toBeDefined();

      if (entry.alternates?.languages) {
        expect(entry.alternates.languages["x-default"]).toBeDefined();
        expect(entry.alternates.languages["x-default"]).toMatch(/^https?:\/\//);
      }
    }
  });

  it("excludes private, thin, and noindex pages from the sitemap", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    for (const url of urls) {
      expect(url).not.toContain("/dashboard");
      expect(url).not.toContain("/admin");
      expect(url).not.toContain("/settings");
      expect(url).not.toContain("/sign-in");
      expect(url).not.toContain("/sign-up");
      expect(url).not.toContain("/api/");
      expect(url).not.toContain("/u/");
    }
  });

  it("includes all blog posts with their publish dates", () => {
    const entries = sitemap();
    const blogEntries = entries.filter(
      (e) => e.url.includes("/blog/") && !e.url.endsWith("/blog"),
    );
    expect(blogEntries.length).toBeGreaterThan(0);
    for (const entry of blogEntries) {
      expect(entry.lastModified).toBeDefined();
      expect(entry.lastModified instanceof Date).toBe(true);
    }
  });
});
