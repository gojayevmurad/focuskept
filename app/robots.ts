// SPDX-License-Identifier: AGPL-3.0-only
import type { MetadataRoute } from "next";
import { getAppConfig } from "@/src/config/app";
import { routing } from "@/src/i18n/routing";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const app = getAppConfig();
  const sitemapUrl = new URL("/sitemap.xml", app.url).toString();

  const basePrivate = [
    "/api/",
    "/dashboard",
    "/book",
    "/session",
    "/settings",
    "/admin",
    "/onboarding",
    "/people",
    "/progress",
    "/billing",
    "/invite",
    "/groups",
    "/challenges",
    "/hosting",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/r/",
  ];

  const nonDefaultLocales = routing.locales.filter(
    (l) => l !== routing.defaultLocale,
  );
  const localizedPrivate = nonDefaultLocales.flatMap((locale) =>
    basePrivate.map((p) => `/${locale}${p}`),
  );

  const disallow = Array.from(new Set([...basePrivate, ...localizedPrivate]));

  const allowedCrawlers = [
    "*",
    "Googlebot",
    "Bingbot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "PerplexityBot",
    "Perplexity-User",
    "ClaudeBot",
    "Claude-User",
    "Claude-SearchBot",
    "Applebot",
    "DuckDuckBot",
    "GPTBot",
    "Google-Extended",
  ];

  return {
    rules: [
      {
        userAgent: allowedCrawlers,
        allow: "/",
        disallow,
      },
      {
        userAgent: "CCBot",
        disallow: "/",
      },
    ],
    sitemap: sitemapUrl,
  };
}
