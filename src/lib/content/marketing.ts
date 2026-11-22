// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { routing, type Locale } from "@/src/i18n/routing";

export type LocaleProps = { params: Promise<{ locale: string }> };
export type SlugProps = { params: Promise<{ locale: string; slug: string }> };

export function requireMarketing() {
  if (!getAppConfig().marketingEnabled) notFound();
}

export function absoluteUrl(path: string) {
  return new URL(path, getAppConfig().url).toString();
}

/** Ensure consistent trailing slash handling (never trailing slash except root). */
export function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "");
}

/** English stays unprefixed; other locales live under /<locale>. */
export function localizedPath(path: string, locale: string) {
  const clean = normalizePath(path);
  if (clean === "/") {
    return locale === routing.defaultLocale ? "/" : `/${locale}`;
  }
  return locale === routing.defaultLocale ? clean : `/${locale}${clean}`;
}

/** hreflang map for a page that exists in the given locales. */
export function languageAlternates(
  path: string,
  locales: readonly string[] = routing.locales,
) {
  const clean = normalizePath(path);
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = absoluteUrl(localizedPath(clean, l));
  languages["x-default"] = absoluteUrl(localizedPath(clean, routing.defaultLocale));
  return languages;
}

export function pageMetadata(
  title: string,
  description: string,
  path: string,
  locale: string = routing.defaultLocale,
  locales: readonly Locale[] | readonly string[] = routing.locales,
): Metadata {
  const clean = normalizePath(path);
  const url = absoluteUrl(localizedPath(clean, locale));
  const app = getAppConfig();
  const ogImageUrl = absoluteUrl("/opengraph-image");

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(clean, locales),
    },
    openGraph: {
      title,
      description,
      url,
      siteName: app.name,
      type: "website",
      locale,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      maxImagePreview: "large",
      maxSnippet: -1,
      maxVideoPreview: -1,
    },
  };
}

export async function translatedMetadata(
  params: LocaleProps["params"],
  namespace: string,
  path: string,
) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace });
  return pageMetadata(
    t("title", { app: getAppConfig().name }),
    t("description"),
    path,
    locale,
  );
}

/** Metadata generator for private or thin pages that must never be indexed. */
export function privatePageMetadata(title: string): Metadata {
  return {
    title,
    robots: {
      index: false,
      follow: false,
    },
  };
}
