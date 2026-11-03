/** One rule-based suggestion for the weekly report (most important first). */
export type WeeklySuggestion =
  | { key: "start" }
  | { key: "retention"; percent: number }
  | { key: "goal"; percent: number }
  | { key: "bestTechnique"; technique: string }
  | { key: "keepGoing" };

export function weeklySuggestion(input: {
  focusedMinutes: number;
  goalMinutes: number;
  reviews: number;
  retention: number | null;
  bestTechnique: string | null;
}): WeeklySuggestion {
  if (input.focusedMinutes < 10) return { key: "start" };
  if (input.reviews >= 3 && input.retention !== null && input.retention < 0.7)
    return { key: "retention", percent: Math.round(input.retention * 100) };
  if (input.goalMinutes > 0 && input.focusedMinutes < input.goalMinutes * 0.8)
    return {
      key: "goal",
      percent: Math.round((input.focusedMinutes / input.goalMinutes) * 100),
    };
  if (input.bestTechnique)
    return { key: "bestTechnique", technique: input.bestTechnique };
  return { key: "keepGoing" };
}
