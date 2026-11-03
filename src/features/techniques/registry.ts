// Typed technique registry: behaviour and structure live in code,
// prose lives in content/techniques/<locale>.json. The database stores slugs.
import {
  LEARNING_METHODS,
  PLANNING_TECHNIQUES,
  TIME_TECHNIQUES,
  type LearningMethod,
  type PlanningTechnique,
  type TechniqueSlug,
  type TimeTechnique,
} from "./slugs";

export type TechniqueGroup = "time" | "learning" | "planning";
export type Mode = "work" | "learning";

/** Special layouts in the Learning-session guide panel. */
export type GuideLayout =
  "steps" | "cornell" | "blurting" | "interleaving" | "sq3r" | "leitner";

export type IconName =
  | "timer"
  | "hourglass"
  | "waves"
  | "brain-circuit"
  | "sliders"
  | "box"
  | "message-square-text"
  | "repeat"
  | "pen-line"
  | "book-open"
  | "notebook-tabs"
  | "shuffle"
  | "archive"
  | "calendar-clock"
  | "flame"
  | "grid-2x2"
  | "list-ordered"
  | "list-checks";

type Base = {
  slug: TechniqueSlug;
  group: TechniqueGroup;
  modes: readonly Mode[];
  icon: IconName;
  related: readonly TechniqueSlug[];
};
export type TimeEntry = Base & {
  slug: TimeTechnique;
  group: "time";
  /** Shown on cards: "25 / 5", "52 / 17", "↑", … (language-neutral). */
  rhythm: string;
};
export type LearningEntry = Base & {
  slug: LearningMethod;
  group: "learning";
  guide: GuideLayout;
};
export type PlanningEntry = Base & {
  slug: PlanningTechnique;
  group: "planning";
  /** Task view in /app/tasks that implements it. */
  view: "today" | "matrix" | "135" | "ivy";
};
export type TechniqueEntry = TimeEntry | LearningEntry | PlanningEntry;

const both = ["work", "learning"] as const;

export const registry: { [K in TechniqueSlug]: TechniqueEntry & { slug: K } } =
  {
    pomodoro: {
      slug: "pomodoro",
      group: "time",
      modes: both,
      icon: "timer",
      rhythm: "25 / 5",
      related: ["52-17", "flowtime", "active-recall"],
    },
    "52-17": {
      slug: "52-17",
      group: "time",
      modes: both,
      icon: "hourglass",
      rhythm: "52 / 17",
      related: ["pomodoro", "deep-work-90", "flowtime"],
    },
    flowtime: {
      slug: "flowtime",
      group: "time",
      modes: both,
      icon: "waves",
      rhythm: "↑ / ÷5",
      related: ["pomodoro", "deep-work-90", "timeboxing"],
    },
    "deep-work-90": {
      slug: "deep-work-90",
      group: "time",
      modes: both,
      icon: "brain-circuit",
      rhythm: "90 / 20",
      related: ["52-17", "eat-the-frog", "flowtime"],
    },
    custom: {
      slug: "custom",
      group: "time",
      modes: both,
      icon: "sliders",
      rhythm: "x / y",
      related: ["pomodoro", "52-17", "timeboxing"],
    },
    timeboxing: {
      slug: "timeboxing",
      group: "time",
      modes: ["work"],
      icon: "box",
      rhythm: "[ ]",
      related: ["1-3-5", "eisenhower", "pomodoro"],
    },
    feynman: {
      slug: "feynman",
      group: "learning",
      modes: ["learning"],
      icon: "message-square-text",
      guide: "steps",
      related: ["active-recall", "blurting", "spaced-repetition"],
    },
    "active-recall": {
      slug: "active-recall",
      group: "learning",
      modes: ["learning"],
      icon: "repeat",
      guide: "steps",
      related: ["spaced-repetition", "blurting", "leitner"],
    },
    blurting: {
      slug: "blurting",
      group: "learning",
      modes: ["learning"],
      icon: "pen-line",
      guide: "blurting",
      related: ["active-recall", "feynman", "cornell"],
    },
    sq3r: {
      slug: "sq3r",
      group: "learning",
      modes: ["learning"],
      icon: "book-open",
      guide: "sq3r",
      related: ["cornell", "active-recall", "feynman"],
    },
    cornell: {
      slug: "cornell",
      group: "learning",
      modes: ["learning"],
      icon: "notebook-tabs",
      guide: "cornell",
      related: ["sq3r", "active-recall", "blurting"],
    },
    interleaving: {
      slug: "interleaving",
      group: "learning",
      modes: ["learning"],
      icon: "shuffle",
      guide: "interleaving",
      related: ["active-recall", "spaced-repetition", "pomodoro"],
    },
    leitner: {
      slug: "leitner",
      group: "learning",
      modes: ["learning"],
      icon: "archive",
      guide: "leitner",
      related: ["spaced-repetition", "active-recall", "feynman"],
    },
    "spaced-repetition": {
      slug: "spaced-repetition",
      group: "learning",
      modes: ["learning"],
      icon: "calendar-clock",
      guide: "steps",
      related: ["leitner", "active-recall", "feynman"],
    },
    "eat-the-frog": {
      slug: "eat-the-frog",
      group: "planning",
      modes: ["work"],
      icon: "flame",
      view: "today",
      related: ["ivy-lee", "1-3-5", "deep-work-90"],
    },
    eisenhower: {
      slug: "eisenhower",
      group: "planning",
      modes: ["work"],
      icon: "grid-2x2",
      view: "matrix",
      related: ["1-3-5", "ivy-lee", "timeboxing"],
    },
    "1-3-5": {
      slug: "1-3-5",
      group: "planning",
      modes: ["work"],
      icon: "list-checks",
      view: "135",
      related: ["eisenhower", "eat-the-frog", "timeboxing"],
    },
    "ivy-lee": {
      slug: "ivy-lee",
      group: "planning",
      modes: ["work"],
      icon: "list-ordered",
      view: "ivy",
      related: ["eat-the-frog", "1-3-5", "eisenhower"],
    },
  };

export const techniquesByGroup = {
  time: TIME_TECHNIQUES.map((s) => registry[s]) as TimeEntry[],
  learning: LEARNING_METHODS.map((s) => registry[s]) as LearningEntry[],
  planning: PLANNING_TECHNIQUES.map((s) => registry[s]) as PlanningEntry[],
};

export function isTechniqueSlug(value: string): value is TechniqueSlug {
  return value in registry;
}

/** Learning methods whose page is the system core rather than a session choice. */
export const AUTOMATIC_METHODS: readonly LearningMethod[] = [
  "spaced-repetition",
];
