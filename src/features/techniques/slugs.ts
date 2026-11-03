export const TIME_TECHNIQUES = [
  "pomodoro",
  "52-17",
  "flowtime",
  "deep-work-90",
  "custom",
  "timeboxing",
] as const;
export const LEARNING_METHODS = [
  "feynman",
  "active-recall",
  "blurting",
  "sq3r",
  "cornell",
  "interleaving",
  "leitner",
  "spaced-repetition",
] as const;
export const PLANNING_TECHNIQUES = [
  "eat-the-frog",
  "eisenhower",
  "1-3-5",
  "ivy-lee",
] as const;

export type TimeTechnique = (typeof TIME_TECHNIQUES)[number];
export type LearningMethod = (typeof LEARNING_METHODS)[number];
export type PlanningTechnique = (typeof PLANNING_TECHNIQUES)[number];
export type TechniqueSlug = TimeTechnique | LearningMethod | PlanningTechnique;

export const ALL_TECHNIQUES: readonly TechniqueSlug[] = [
  ...TIME_TECHNIQUES,
  ...LEARNING_METHODS,
  ...PLANNING_TECHNIQUES,
];

/**
 * Public URL segment where it differs from the stored id. `pomodoro` stays the
 * id in the database and local data; users only ever see "25/5".
 */
const PUBLIC_SLUGS: Partial<Record<TechniqueSlug, string>> = {
  pomodoro: "25-5",
};

export function publicSlug(slug: TechniqueSlug) {
  return PUBLIC_SLUGS[slug] ?? slug;
}

export function slugFromPublic(segment: string) {
  return ALL_TECHNIQUES.find((slug) => publicSlug(slug) === segment);
}
