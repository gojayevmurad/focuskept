// SPDX-License-Identifier: AGPL-3.0-only
import type { MetadataRoute } from "next";
import { getAppConfig } from "@/src/config/app";
import { listSeoPages, localesFor, templates } from "@/src/lib/content/seo";
import { listBlogPosts } from "@/src/lib/content/blog";
import { routing } from "@/src/i18n/routing";
import { localizedPath } from "@/src/lib/content/marketing";

export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];

const CONTENT_LAST_MODIFIED = new Date("2026-11-21T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const app = getAppConfig();
  const url = (path: string) => new URL(path, app.url).toString();

  // One entry per language version, each listing all reciprocal alternates and x-default.
  const localized = (
    path: string,
    locales: readonly string[] = routing.locales,
    lastModified: Date = CONTENT_LAST_MODIFIED,
  ): Entry[] => {
    const languages: Record<string, string> = Object.fromEntries(
      locales.map((l) => [l, url(localizedPath(path, l))]),
    );
    languages["x-default"] = url(path);

    return locales.map((l) => ({
      url: url(localizedPath(path, l)),
      lastModified,
      alternates: { languages },
    }));
  };

  const entries: Entry[] = [
    // Legal pages are English only
    { url: url("/privacy"), lastModified: CONTENT_LAST_MODIFIED },
    { url: url("/terms"), lastModified: CONTENT_LAST_MODIFIED },
  ];

  if (!app.marketingEnabled) return entries;

  for (const path of [
    "/",
    "/how-it-works",
    "/faq",
    ...(app.billingEnabled ? ["/pricing"] : []),
  ]) {
    entries.push(...localized(path));
  }

  for (const template of templates) {
    const locales = localesFor(template);
    entries.push(...localized(`/${template}`, locales));
    for (const page of listSeoPages(template)) {
      entries.push(...localized(`/${template}/${page.slug}`, locales));
    }
  }

  const posts = listBlogPosts();
  const latestPostDate = posts[0]?.date
    ? new Date(posts[0].date + "T00:00:00.000Z")
    : CONTENT_LAST_MODIFIED;

  entries.push({ url: url("/blog"), lastModified: latestPostDate });

  for (const post of posts) {
    entries.push({
      url: url(`/blog/${post.slug}`),
      lastModified: new Date(post.date + "T00:00:00.000Z"),
    });
  }

  return entries;
}
