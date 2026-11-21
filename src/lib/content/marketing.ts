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
/** English stays unprefixed; other locales live under /<locale>. */
export function localizedPath(path: string, locale: string) {
  const clean = path === "/" ? "" : path;
  return locale === routing.defaultLocale ? path : `/${locale}${clean}`;
}

/** hreflang map for a page that exists in the given locales. */
export function languageAlternates(
  path: string,
  locales: readonly string[] = routing.locales,
) {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = absoluteUrl(localizedPath(path, l));
  languages["x-default"] = absoluteUrl(path);
  return languages;
}

export function pageMetadata(
  title: string,
  description: string,
  path: string,
  locale: string = routing.defaultLocale,
  locales: readonly Locale[] | readonly string[] = routing.locales,
): Metadata {
  const url = absoluteUrl(localizedPath(path, locale));
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(path, locales),
    },
    openGraph: {
      title,
      description,
      url,
      siteName: getAppConfig().name,
      type: "website",
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
