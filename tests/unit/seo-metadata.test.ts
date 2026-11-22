// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  languageAlternates,
  localizedPath,
  normalizePath,
  pageMetadata,
  privatePageMetadata,
} from "@/src/lib/content/marketing";
import { listSeoPages, templates } from "@/src/lib/content/seo";
import { listBlogPosts } from "@/src/lib/content/blog";

describe("SEO Metadata and URL Formatting", () => {
  it("normalizes trailing slashes consistently", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("/how-it-works/")).toBe("/how-it-works");
    expect(normalizePath("/how-it-works")).toBe("/how-it-works");
    expect(normalizePath("/blog/test-slug//")).toBe("/blog/test-slug");
  });

  it("formats localized paths with as-needed prefix", () => {
    expect(localizedPath("/", "en")).toBe("/");
    expect(localizedPath("/", "de")).toBe("/de");
    expect(localizedPath("/how-it-works", "en")).toBe("/how-it-works");
    expect(localizedPath("/how-it-works", "de")).toBe("/de/how-it-works");
    expect(localizedPath("/how-it-works/", "fr")).toBe("/fr/how-it-works");
  });

  it("generates complete reciprocal hreflang alternates including x-default", () => {
    const alternates = languageAlternates("/faq", ["en", "de", "fr"]);
    expect(alternates.en).toContain("/faq");
    expect(alternates.de).toContain("/de/faq");
    expect(alternates.fr).toContain("/fr/faq");
    expect(alternates["x-default"]).toContain("/faq");
    expect(alternates["x-default"]).toBe(alternates.en);
  });

  it("generates complete page metadata with OG image and robots directive", () => {
    const meta = pageMetadata(
      "Body Doubling for ADHD | FocusKept",
      "Gentle accountability for focus.",
      "/body-doubling-for/adhd",
      "en",
      ["en", "de"],
    );

    expect(meta.title).toEqual({
      absolute: "Body Doubling for ADHD | FocusKept",
    });
    expect(meta.description).toBe("Gentle accountability for focus.");
    expect(meta.alternates?.canonical).toContain("/body-doubling-for/adhd");
    expect(meta.alternates?.languages?.["x-default"]).toBeDefined();

    expect(meta.openGraph?.type).toBe("website");
    expect(meta.openGraph?.title).toBe("Body Doubling for ADHD | FocusKept");
    expect(meta.openGraph?.images).toEqual([
      expect.objectContaining({
        url: expect.stringContaining("/opengraph-image"),
        width: 1200,
        height: 630,
      }),
    ]);

    expect(meta.twitter?.card).toBe("summary_large_image");
    expect(meta.twitter?.images).toEqual([
      expect.stringContaining("/opengraph-image"),
    ]);

    const robots = meta.robots as Record<string, unknown>;
    expect(robots?.index).toBe(true);
    expect(robots?.follow).toBe(true);
    expect(robots?.maxImagePreview).toBe("large");
  });

  it("generates private page metadata with noindex and nofollow", () => {
    const meta = privatePageMetadata("Sign in");
    expect(meta.title).toBe("Sign in");
    const robots = meta.robots as Record<string, unknown>;
    expect(robots?.index).toBe(false);
    expect(robots?.follow).toBe(false);
  });

  describe("Content Metadata Audit across all pages", () => {
    it("ensures all SEO programmatic pages have titles <= 60 chars and descriptions <= 155 chars", () => {
      for (const template of templates) {
        const pages = listSeoPages(template, "en");
        for (const page of pages) {
          expect(
            page.title.length,
            `Page title too long: "${page.title}" (${page.title.length} chars) in ${template}/${page.slug}`,
          ).toBeLessThanOrEqual(60);

          expect(
            page.description.length,
            `Page description too long: "${page.description}" (${page.description.length} chars) in ${template}/${page.slug}`,
          ).toBeLessThanOrEqual(155);
        }
      }
    });

    it("ensures all blog posts have titles <= 60 chars and descriptions <= 155 chars", () => {
      const posts = listBlogPosts();
      expect(posts.length).toBeGreaterThan(0);
      for (const post of posts) {
        expect(
          post.title.length,
          `Blog title too long: "${post.title}" (${post.title.length} chars) in ${post.slug}`,
        ).toBeLessThanOrEqual(60);

        expect(
          post.description.length,
          `Blog description too long: "${post.description}" (${post.description.length} chars) in ${post.slug}`,
        ).toBeLessThanOrEqual(155);
      }
    });
  });
});
