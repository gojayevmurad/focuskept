// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import body from "@/content/seo/body-doubling-for.json";
import study from "@/content/seo/study-with-me.json";
import coworking from "@/content/seo/virtual-coworking-for.json";
import alternatives from "@/content/seo/alternatives.json";
import { getAppConfig } from "@/src/config/app";
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
const sources: Record<SeoTemplate, { template: string; pages: SeoPage[] }> = {
  "body-doubling-for": body,
  "study-with-me": study,
  "virtual-coworking-for": coworking,
  alternatives,
};
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
export function listSeoPages(template?: SeoTemplate) {
  const name = getAppConfig().name;
  return (template ? [template] : templates).flatMap((key) =>
    sources[key].pages.map((page) => ({
      ...replaceApp(page, name),
      template: key,
    })),
  );
}
export function getSeoPage(template: SeoTemplate, slug: string) {
  return listSeoPages(template).find((page) => page.slug === slug);
}
