import type { MetadataRoute } from "next";
import { locales } from "@/src/i18n/config";
import { ALL_TECHNIQUES, publicSlug } from "@/src/features/techniques/slugs";
import { appUrl } from "@/src/lib/site";

const PAGES = [
  "",
  "/techniques",
  "/pricing",
  "/focus",
  "/learn",
  "/about",
  "/privacy",
  "/terms",
];

/** Every public page in all 24 locales, with hreflang alternates and x-default → /en. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const paths = [
    ...PAGES,
    ...ALL_TECHNIQUES.map((slug) => `/techniques/${publicSlug(slug)}`),
  ];
  return paths.flatMap((path) => {
    const languages = {
      ...Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`])),
      "x-default": `${base}/en${path}`,
    };
    return locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path.startsWith("/techniques/") ? 0.8 : 0.6,
      alternates: { languages },
    }));
  });
}
