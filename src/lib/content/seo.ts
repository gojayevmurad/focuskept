// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import body from "@/content/seo/body-doubling-for.json";
import study from "@/content/seo/study-with-me.json";
import coworking from "@/content/seo/virtual-coworking-for.json";
import alternatives from "@/content/seo/alternatives.json";
import deBody from "@/content/seo/de/body-doubling-for.json";
import deCoworking from "@/content/seo/de/virtual-coworking-for.json";
import deAlternatives from "@/content/seo/de/alternatives.json";
import frBody from "@/content/seo/fr/body-doubling-for.json";
import frCoworking from "@/content/seo/fr/virtual-coworking-for.json";
import frAlternatives from "@/content/seo/fr/alternatives.json";
import nlBody from "@/content/seo/nl/body-doubling-for.json";
import nlCoworking from "@/content/seo/nl/virtual-coworking-for.json";
import nlAlternatives from "@/content/seo/nl/alternatives.json";
import esBody from "@/content/seo/es/body-doubling-for.json";
import esCoworking from "@/content/seo/es/virtual-coworking-for.json";
import esAlternatives from "@/content/seo/es/alternatives.json";
import { getAppConfig } from "@/src/config/app";
import { routing } from "@/src/i18n/routing";

export const templates = [
  "body-doubling-for",
  "study-with-me",
  "virtual-coworking-for",
  "alternatives",
] as const;

export type SeoTemplate = (typeof templates)[number];
export type Faq = { q: string; a: string };

export type SeoPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
  faq: Faq[];
  cta: { heading: string; body: string };
  keywords: string[];
};

type Source = { template: string; pages: SeoPage[] };

// US exam pages (study-with-me) are English only.
const sources: Record<string, Partial<Record<SeoTemplate, Source>>> = {
  en: {
    "body-doubling-for": body,
    "study-with-me": study,
    "virtual-coworking-for": coworking,
    alternatives,
  },
  de: {
    "body-doubling-for": deBody,
    "virtual-coworking-for": deCoworking,
    alternatives: deAlternatives,
  },
  fr: {
    "body-doubling-for": frBody,
    "virtual-coworking-for": frCoworking,
    alternatives: frAlternatives,
  },
  nl: {
    "body-doubling-for": nlBody,
    "virtual-coworking-for": nlCoworking,
    alternatives: nlAlternatives,
  },
  es: {
    "body-doubling-for": esBody,
    "virtual-coworking-for": esCoworking,
    alternatives: esAlternatives,
  },
};

/** Locales that have a given template, for hreflang and sitemaps. */
export function localesFor(template: SeoTemplate) {
  return routing.locales.filter((l) => sources[l]?.[template]);
}

// Walk values rather than serialized JSON so app names containing quotes stay valid.
export function replaceApp<T>(value: T, name: string): T {
  if (typeof value === "string") return value.replaceAll("{app}", name) as T;
  if (Array.isArray(value))
    return value.map((item) => replaceApp(item, name)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceApp(item, name)]),
    ) as T;
  }
  return value;
}

export function listSeoPages(template?: SeoTemplate, locale = "en") {
  const name = getAppConfig().name;
  const bundle = sources[locale] ?? {};
  return (template ? [template] : templates).flatMap((key) =>
    (bundle[key]?.pages ?? []).map((page) => ({
      ...replaceApp(page, name),
      template: key,
    })),
  );
}

export function getSeoPage(template: SeoTemplate, slug: string, locale = "en") {
  return listSeoPages(template, locale).find((page) => page.slug === slug);
}

/** Returns all canonical marketing paths for indexing and sitemaps. */
export function allPublicMarketingPaths(): string[] {
  const paths: string[] = ["/", "/how-it-works", "/faq"];
  if (getAppConfig().billingEnabled) {
    paths.push("/pricing");
  }
  for (const template of templates) {
    paths.push(`/${template}`);
    for (const page of listSeoPages(template, "en")) {
      paths.push(`/${template}/${page.slug}`);
    }
  }
  paths.push("/blog");
  return paths;
}
