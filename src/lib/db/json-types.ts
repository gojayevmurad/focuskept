// Shapes of jsonb columns. Shared by the schema, server helpers and clients.

/** Per weekday (0 = Sunday … 6 = Saturday): the window in which pushes and
 * nudges may be sent, or null for no notifications that day. The daily review
 * digest email is exempt. */
export type WorkHours = Record<
  "0" | "1" | "2" | "3" | "4" | "5" | "6",
  { start: string; end: string } | null
>;

export type TimerDurations = {
  /** Minutes. */
  work: number;
  shortBreak: number;
  longBreak: number;
  /** Work blocks before a long break. */
  cycles: number;
};

export type TechniqueSettings = {
  pomodoro?: Partial<TimerDurations>;
  custom?: Partial<TimerDurations>;
  timeboxing?: { boxMinutes?: number };
};

export type CustomPreset = { id: string; name: string } & TimerDurations;

/** Background sounds: all generated in the browser except the optional café file. */
export const BACKGROUND_SOUNDS = [
  "none",
  "white",
  "pink",
  "brown",
  "rain",
  "stream",
  "ocean",
  "wind",
  "fire",
  "night",
  "binaural",
  "cafe",
] as const;

export type SoundSettings = {
  chime: boolean;
  /** 0–1 */
  chimeVolume: number;
  background: (typeof BACKGROUND_SOUNDS)[number];
  /** 0–1 */
  backgroundVolume: number;
};

export type ExplanationAnalysis = {
  clarityScore: number;
  gaps: string[];
  mistakes: string[];
  rewriteSuggestion: string;
};

export type QuestionType = "open" | "true_false" | "cloze";

export type DraftQuestion = {
  type: QuestionType;
  prompt: string;
  answer: string;
  explanation: string;
  source: "ai" | "user" | "ai_edited";
};

/** Method-specific notes written during a Learning session. */
export type LearningNotes = {
  notes?: string;
  cornell?: { notes: string; cues: string; summary: string };
  blurting?: { dump: string; compare: string };
  interleaving?: { topics: string[] };
  sq3r?: Partial<
    Record<"survey" | "question" | "read" | "recite" | "review", string>
  >;
};

export const defaultWorkHours: WorkHours = {
  "0": { start: "08:00", end: "21:00" },
  "1": { start: "08:00", end: "21:00" },
  "2": { start: "08:00", end: "21:00" },
  "3": { start: "08:00", end: "21:00" },
  "4": { start: "08:00", end: "21:00" },
  "5": { start: "08:00", end: "21:00" },
  "6": { start: "08:00", end: "21:00" },
};

export const defaultSoundSettings: SoundSettings = {
  chime: true,
  chimeVolume: 0.6,
  background: "none",
  backgroundVolume: 0.35,
};
