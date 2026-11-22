// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  ALL_LEGACY_LOCALES,
  ACTIVE_LOCALES,
  OTHER_LOCALES,
  getLegacyRedirects,
} from "@/src/config/legacy-redirects";

describe("legacy redirects", () => {
  const redirects = getLegacyRedirects();

  it("marks all redirects as permanent", () => {
    expect(redirects.length).toBeGreaterThan(0);
    for (const rule of redirects) {
      expect(rule.permanent).toBe(true);
    }
  });

  it("ensures every source starts with a supported old locale", () => {
    const supportedLocalesSet = new Set<string>(ALL_LEGACY_LOCALES);
    const regexGroupPrefix = /^\/:lang\(([^)]+)\)/;

    for (const rule of redirects) {
      const match = rule.source.match(regexGroupPrefix);
      if (match) {
        const langs = match[1].split("|");
        expect(langs.length).toBeGreaterThan(0);
        for (const lang of langs) {
          expect(supportedLocalesSet.has(lang)).toBe(true);
        }
      } else {
        const parts = rule.source.split("/").filter(Boolean);
        const firstSegment = parts[0];
        expect(supportedLocalesSet.has(firstSegment)).toBe(true);
      }
    }
  });

  it("contains expected source/destination pairs for en", () => {
    const expectedEnMappings: Array<{ source: string; destination: string }> = [
      { source: "/en/about", destination: "/how-it-works" },
      { source: "/en/focus", destination: "/how-it-works" },
      { source: "/en/learn", destination: "/how-it-works" },
      { source: "/en/techniques", destination: "/blog" },
      { source: "/en/techniques/:slug", destination: "/blog" },
      { source: "/en/app", destination: "/dashboard" },
      { source: "/en/app/:path*", destination: "/dashboard" },
    ];

    for (const expected of expectedEnMappings) {
      const found = redirects.find(
        (rule) =>
          rule.source === expected.source &&
          rule.destination === expected.destination,
      );
      expect(found).toBeDefined();
    }
  });

  it("does not redirect /en/* pages that still exist", () => {
    const nonRedirectedEnPages = [
      "/en/privacy",
      "/en/terms",
      "/en/pricing",
      "/en/sign-in",
      "/en/sign-up",
      "/en/dashboard",
    ];

    for (const page of nonRedirectedEnPages) {
      const found = redirects.find((rule) => rule.source === page);
      expect(found).toBeUndefined();
    }
  });

  it("contains expected source/destination pairs for active locales (de, fr, nl, es)", () => {
    for (const locale of ACTIVE_LOCALES) {
      const expectedMappings = [
        { source: `/${locale}/about`, destination: `/${locale}/how-it-works` },
        { source: `/${locale}/focus`, destination: `/${locale}/how-it-works` },
        { source: `/${locale}/learn`, destination: `/${locale}/how-it-works` },
        { source: `/${locale}/techniques`, destination: `/${locale}/blog` },
        {
          source: `/${locale}/techniques/:slug`,
          destination: `/${locale}/blog`,
        },
        { source: `/${locale}/app`, destination: `/${locale}/dashboard` },
        {
          source: `/${locale}/app/:path*`,
          destination: `/${locale}/dashboard`,
        },
      ];

      for (const expected of expectedMappings) {
        const found = redirects.find(
          (rule) =>
            rule.source === expected.source &&
            rule.destination === expected.destination,
        );
        expect(found).toBeDefined();
      }
    }
  });

  it("contains expected source/destination pairs for other locales using a single regex group", () => {
    const otherLangsPattern = OTHER_LOCALES.join("|");
    const prefix = `/:lang(${otherLangsPattern})`;

    const expectedOtherMappings = [
      { source: `${prefix}/about`, destination: "/how-it-works" },
      { source: `${prefix}/focus`, destination: "/how-it-works" },
      { source: `${prefix}/learn`, destination: "/how-it-works" },
      { source: `${prefix}/techniques`, destination: "/blog" },
      { source: `${prefix}/techniques/:slug`, destination: "/blog" },
      { source: `${prefix}/app`, destination: "/dashboard" },
      { source: `${prefix}/app/:path*`, destination: "/dashboard" },
      { source: `${prefix}/privacy`, destination: "/privacy" },
      { source: `${prefix}/terms`, destination: "/terms" },
      { source: `${prefix}/pricing`, destination: "/pricing" },
      { source: `${prefix}/sign-in`, destination: "/sign-in" },
      { source: `${prefix}/sign-up`, destination: "/sign-up" },
      { source: `${prefix}/forgot-password`, destination: "/forgot-password" },
      { source: `${prefix}/reset-password`, destination: "/reset-password" },
      { source: `${prefix}/verify-email`, destination: "/verify-email" },
      { source: `${prefix}/unsubscribe`, destination: "/unsubscribe" },
      { source: `${prefix}/:path*`, destination: "/" },
      { source: prefix, destination: "/" },
    ];

    for (const expected of expectedOtherMappings) {
      const found = redirects.find(
        (rule) =>
          rule.source === expected.source &&
          rule.destination === expected.destination,
      );
      expect(found).toBeDefined();
    }
  });

  it("orders rules from most specific to least specific", () => {
    const otherLangsPattern = OTHER_LOCALES.join("|");
    const prefix = `/:lang(${otherLangsPattern})`;

    const catchAllIndex = redirects.findIndex(
      (rule) => rule.source === `${prefix}/:path*`,
    );
    const rootIndex = redirects.findIndex((rule) => rule.source === prefix);

    expect(catchAllIndex).toBeGreaterThan(-1);
    expect(rootIndex).toBeGreaterThan(-1);

    const specificOtherSources = [
      `${prefix}/techniques/:slug`,
      `${prefix}/techniques`,
      `${prefix}/app/:path*`,
      `${prefix}/app`,
      `${prefix}/about`,
      `${prefix}/focus`,
      `${prefix}/learn`,
      `${prefix}/privacy`,
      `${prefix}/terms`,
      `${prefix}/pricing`,
      `${prefix}/sign-in`,
      `${prefix}/sign-up`,
      `${prefix}/forgot-password`,
      `${prefix}/reset-password`,
      `${prefix}/verify-email`,
      `${prefix}/unsubscribe`,
    ];

    for (const src of specificOtherSources) {
      const idx = redirects.findIndex((rule) => rule.source === src);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeLessThan(catchAllIndex);
      expect(idx).toBeLessThan(rootIndex);
    }

    expect(
      redirects.findIndex((r) => r.source === "/en/techniques/:slug"),
    ).toBeLessThan(redirects.findIndex((r) => r.source === "/en/techniques"));
    expect(
      redirects.findIndex((r) => r.source === "/en/app/:path*"),
    ).toBeLessThan(redirects.findIndex((r) => r.source === "/en/app"));
  });
});
