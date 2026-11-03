import "server-only";
import type { Locale } from "@/src/i18n/config";
import type { TechniqueSlug } from "./slugs";
import type english from "@/content/techniques/en.json";

export type TechniqueContent = (typeof english)["pomodoro"] & {
  name: string;
};
export type TechniqueContentMap = Record<TechniqueSlug, TechniqueContent>;

/** Localized technique prose. Every locale file mirrors en.json (i18n-check). */
export async function getTechniqueContent(
  locale: Locale,
): Promise<TechniqueContentMap> {
  if (locale !== "en") {
    try {
      return (await import(`@/content/techniques/${locale}.json`))
        .default as TechniqueContentMap;
    } catch {
      // Missing translation file: fall back so the page renders (CI fails i18n-check).
    }
  }
  return (await import("@/content/techniques/en.json"))
    .default as TechniqueContentMap;
}

/** Names + taglines for pickers and badges (small enough to send to the client). */
export async function techniqueLabels(locale: Locale) {
  const content = await getTechniqueContent(locale);
  return Object.fromEntries(
    Object.entries(content).map(([slug, c]) => [
      slug,
      { name: c.name, tagline: c.tagline },
    ]),
  ) as Record<TechniqueSlug, { name: string; tagline: string }>;
}

/** Localized guide steps for each learning method (shown beside the timer). */
export async function learningGuideSteps(locale: Locale) {
  const content = await getTechniqueContent(locale);
  const { LEARNING_METHODS } = await import("./slugs");
  return Object.fromEntries(
    LEARNING_METHODS.map((m) => [m, content[m].steps]),
  ) as Record<string, string[]>;
}
