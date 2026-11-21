// SPDX-License-Identifier: AGPL-3.0-only
import type { MetadataRoute } from "next";
import { getAppConfig } from "@/src/config/app";
import { listSeoPages, templates } from "@/src/lib/content/seo";
import { listBlogPosts } from "@/src/lib/content/blog";
export default function sitemap(): MetadataRoute.Sitemap {
  const app = getAppConfig();
  const paths = ["/privacy", "/terms"];
  if (app.marketingEnabled) {
    paths.push(
      "/",
      "/how-it-works",
      "/faq",
      "/blog",
      ...templates.map((template) => `/${template}`),
      ...listSeoPages().map((page) => `/${page.template}/${page.slug}`),
    );
    if (app.billingEnabled) paths.push("/pricing");
  }
  return [
    ...paths.map((path) => ({ url: new URL(path, app.url).toString() })),
    ...(app.marketingEnabled
      ? listBlogPosts().map((post) => ({
          url: new URL(`/blog/${post.slug}`, app.url).toString(),
          lastModified: post.date,
        }))
      : []),
  ];
}
