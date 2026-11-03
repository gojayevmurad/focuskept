import type { TimeTechnique } from "./slugs";

/** Optional "what kind of work is this?" chip chosen at session setup. */
export type WorkContext = "study" | "deep" | "admin" | "stuck";

export type RecommendationSession = {
  technique: string;
  rating: number | null;
  tags: readonly string[];
  focusedSeconds: number;
  breakSeconds: number;
  cyclesCompleted: number;
};

export type Recommendation = {
  technique: TimeTechnique;
  /** Message key under `focus.recommend.reasons` plus its values. */
  reason:
    | { key: "bestForTag"; tag: string; rating: number }
    | { key: "bestOverall"; rating: number }
    | { key: "stuck" }
    | { key: "skipsBreaks" }
    | { key: "study" }
    | { key: "deepLong" }
    | { key: "deepShort" }
    | { key: "default" };
};

const RECOMMENDABLE = new Set<string>([
  "pomodoro",
  "52-17",
  "flowtime",
  "deep-work-90",
  "custom",
  "timeboxing",
]);
const MIN_RATED = 3;

/** Best average rating (ties → more sessions), if at least MIN_RATED sessions are rated. */
function bestRated(sessions: readonly RecommendationSession[]) {
  const rated = sessions.filter(
    (s) => s.rating !== null && RECOMMENDABLE.has(s.technique),
  );
  if (rated.length < MIN_RATED) return null;
  const byTechnique = new Map<string, { sum: number; count: number }>();
  for (const s of rated) {
    const entry = byTechnique.get(s.technique) ?? { sum: 0, count: 0 };
    entry.sum += s.rating!;
    entry.count += 1;
    byTechnique.set(s.technique, entry);
  }
  let best: { technique: string; average: number; count: number } | null = null;
  for (const [technique, { sum, count }] of byTechnique) {
    const average = sum / count;
    if (
      !best ||
      average > best.average + 1e-9 ||
      (Math.abs(average - best.average) < 1e-9 && count > best.count)
    )
      best = { technique, average, count };
  }
  return (
    best && {
      technique: best.technique as TimeTechnique,
      rating: Math.round(best.average * 10) / 10,
    }
  );
}

/** A user "often skips breaks" when most of their recent multi-block sessions had almost no break. */
export function skipsBreaks(sessions: readonly RecommendationSession[]) {
  const relevant = sessions.filter(
    (s) =>
      s.cyclesCompleted >= 1 &&
      s.technique !== "flowtime" &&
      s.technique !== "timeboxing",
  );
  if (relevant.length < MIN_RATED) return false;
  const skipped = relevant.filter(
    (s) => s.breakSeconds < 60 * s.cyclesCompleted,
  ).length;
  return skipped / relevant.length >= 0.5;
}

function typicalMinutes(sessions: readonly RecommendationSession[]) {
  const values = sessions
    .map((s) => s.focusedSeconds / 60)
    .filter((m) => m >= 10)
    .sort((a, b) => a - b);
  if (!values.length) return 0;
  return values[Math.floor(values.length / 2)];
}

/** Rule-based recommendation. No AI involved. */
export function recommendTechnique(input: {
  sessions: readonly RecommendationSession[];
  tag?: string;
  context?: WorkContext;
}): Recommendation {
  const { sessions, tag, context } = input;
  if (tag) {
    const best = bestRated(sessions.filter((s) => s.tags.includes(tag)));
    if (best)
      return {
        technique: best.technique,
        reason: { key: "bestForTag", tag, rating: best.rating },
      };
  }
  const overall = bestRated(sessions);
  if (overall)
    return {
      technique: overall.technique,
      reason: { key: "bestOverall", rating: overall.rating },
    };
  if (context === "stuck")
    return { technique: "pomodoro", reason: { key: "stuck" } };
  if (skipsBreaks(sessions))
    return { technique: "flowtime", reason: { key: "skipsBreaks" } };
  if (context === "study")
    return { technique: "pomodoro", reason: { key: "study" } };
  if (context === "deep")
    return typicalMinutes(sessions) >= 75
      ? { technique: "deep-work-90", reason: { key: "deepLong" } }
      : { technique: "52-17", reason: { key: "deepShort" } };
  return { technique: "pomodoro", reason: { key: "default" } };
}
