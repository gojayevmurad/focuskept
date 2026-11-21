// SPDX-License-Identifier: AGPL-3.0-only
import type { MetadataRoute } from "next";
import { getAppConfig } from "@/src/config/app";
import { listSeoPages, localesFor, templates } from "@/src/lib/content/seo";
import { listBlogPosts } from "@/src/lib/content/blog";
import { routing } from "@/src/i18n/routing";
import { localizedPath } from "@/src/lib/content/marketing";

export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];

export default function sitemap(): MetadataRoute.Sitemap {
  const app = getAppConfig();
  const url = (path: string) => new URL(path, app.url).toString();
  // One entry per language version, each listing all of its alternates.
  const localized = (
    path: string,
    locales: readonly string[] = routing.locales,
  ): Entry[] => {
    const languages = Object.fromEntries(
      locales.map((l) => [l, url(localizedPath(path, l))]),
    );
    return locales.map((l) => ({
      url: url(localizedPath(path, l)),
      alternates: { languages },
    }));
  };

  const entries: Entry[] = [
    // Legal pages and the blog are English only.
    { url: url("/privacy") },
    { url: url("/terms") },
  ];
  if (!app.marketingEnabled) return entries;

  for (const path of [
    "/",
    "/how-it-works",
    "/faq",
    ...(app.billingEnabled ? ["/pricing"] : []),
  ])
    entries.push(...localized(path));
  for (const template of templates) {
    const locales = localesFor(template);
    entries.push(...localized(`/${template}`, locales));
    for (const page of listSeoPages(template))
      entries.push(...localized(`/${template}/${page.slug}`, locales));
  }
  entries.push({ url: url("/blog") });
  for (const post of listBlogPosts())
    entries.push({ url: url(`/blog/${post.slug}`), lastModified: post.date });
  return entries;
}
