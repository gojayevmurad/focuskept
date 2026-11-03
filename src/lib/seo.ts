import type { Metadata } from "next";
import { locales, type Locale } from "@/src/i18n/config";
import { brand } from "@/src/config/brand";
import { appUrl } from "./site";

/** Open Graph locale codes (language_TERRITORY), as Facebook and LinkedIn expect them. */
export const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  ar: "ar_AR",
  az: "az_AZ",
  cs: "cs_CZ",
  de: "de_DE",
  el: "el_GR",
  es: "es_ES",
  fa: "fa_IR",
  fr: "fr_FR",
  hi: "hi_IN",
  hu: "hu_HU",
  id: "id_ID",
  it: "it_IT",
  ja: "ja_JP",
  ko: "ko_KR",
  nl: "nl_NL",
  pl: "pl_PL",
  "pt-BR": "pt_BR",
  ru: "ru_RU",
  tr: "tr_TR",
  uk: "uk_UA",
  ur: "ur_PK",
  vi: "vi_VN",
  "zh-CN": "zh_CN",
};

/** Absolute URL of a localized page; `path` is locale-less, e.g. "/pricing". */
export function pageUrl(locale: Locale, path = "/") {
  return `${appUrl()}/${locale}${path === "/" ? "" : path}`;
}

/** Canonical + hreflang alternates for a locale-less path (e.g. "/pricing"). */
export function localizedAlternates(
  locale: Locale,
  path: string,
): Metadata["alternates"] {
  return {
    canonical: pageUrl(locale, path),
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, pageUrl(l, path)])),
      "x-default": pageUrl("en", path),
    },
  };
}

/**
 * Complete metadata for an indexable public page: title, description,
 * canonical + hreflang, Open Graph (url, locale and alternates, image) and a
 * large Twitter/X card. Pages with their own opengraph-image file pass
 * `ownImage` so Next.js attaches that file instead of the locale card.
 */
export function publicMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle = false,
  type = "website",
  ownImage = false,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
  type?: "website" | "article";
  ownImage?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${brand.name}`;
  const image = {
    url: `${pageUrl(locale)}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: fullTitle,
    type: "image/png",
  };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: localizedAlternates(locale, path),
    openGraph: {
      type,
      url: pageUrl(locale, path),
      siteName: brand.name,
      title: fullTitle,
      description,
      locale: OG_LOCALES[locale],
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALES[l]),
      ...(ownImage ? {} : { images: [image] }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(ownImage ? {} : { images: [image.url] }),
    },
  };
}
