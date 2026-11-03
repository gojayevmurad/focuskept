"use client";
// Anonymous Work-mode data lives in localStorage under a versioned key and is
// imported into the account on sign-up (POST /api/import/local).
import type {
  CustomPreset,
  SoundSettings,
  TechniqueSettings,
} from "@/src/lib/db/json-types";
import type {
  PlanningTechnique,
  TimeTechnique,
} from "@/src/features/techniques/slugs";

export const LOCAL_KEY = "focuskept:v1";
/** Keep well under typical 5 MB quotas. */
export const MAX_LOCAL_BYTES = 1_000_000;
export const MAX_LOCAL_SESSIONS = 2000;
export const MAX_LOCAL_TASKS = 500;

export type LocalTask = {
  clientId: string;
  title: string;
  status: "todo" | "done";
  tags: string[];
  createdAt: string;
  completedAt?: string;
};

export type LocalSession = {
  clientId: string;
  mode: "work";
  timeTechnique: TimeTechnique;
  planningTechnique?: PlanningTechnique;
  taskClientId?: string;
  goal: string;
  startedAt: string;
  endedAt: string;
  focusedSeconds: number;
  breakSeconds: number;
  cyclesCompleted: number;
  interruptions: number;
  overrunSeconds: number;
  focusRating: number | null;
  note: string | null;
};

export type LocalData = {
  version: 1;
  tasks: LocalTask[];
  sessions: LocalSession[];
  settings: {
    sound?: SoundSettings;
    techniqueSettings?: TechniqueSettings;
    customPresets?: CustomPreset[];
    lastTechnique?: TimeTechnique;
  };
  /** Set after a successful import so the prompt never repeats. */
  importedAt?: string;
  /** Set when the prompt is declined; only records added later bring it back. */
  importDeclinedAt?: string;
};

export function emptyLocal(): LocalData {
  return { version: 1, tasks: [], sessions: [], settings: {} };
}

/** One migration per version. v0 = pre-release shape without a version field. */
export function migrateLocal(raw: unknown): LocalData {
  if (!raw || typeof raw !== "object") return emptyLocal();
  const data = raw as Partial<LocalData> & { version?: number };
  if (data.version === undefined) {
    return {
      version: 1,
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      settings:
        typeof data.settings === "object" && data.settings ? data.settings : {},
    };
  }
  if (data.version === 1)
    return {
      ...emptyLocal(),
      ...data,
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
    } as LocalData;
  return emptyLocal();
}

/** Trims the oldest records until the data fits the size guard. */
export function guardSize(data: LocalData): LocalData {
  const next = {
    ...data,
    sessions: data.sessions.slice(-MAX_LOCAL_SESSIONS),
    tasks: data.tasks.slice(-MAX_LOCAL_TASKS),
  };
  while (
    JSON.stringify(next).length > MAX_LOCAL_BYTES &&
    next.sessions.length > 0
  )
    next.sessions = next.sessions.slice(Math.ceil(next.sessions.length / 10));
  return next;
}

export function readLocal(): LocalData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? migrateLocal(JSON.parse(raw)) : emptyLocal();
  } catch {
    return emptyLocal();
  }
}

export function writeLocal(data: LocalData) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(guardSize(data)));
  } catch {}
  window.dispatchEvent(new Event("focuskept:local"));
}

export function updateLocal(change: (data: LocalData) => LocalData) {
  const next = change(readLocal());
  writeLocal(next);
  return next;
}

export function hasImportableData(data: LocalData) {
  if (data.importedAt) return false;
  if (!data.importDeclinedAt)
    return data.sessions.length > 0 || data.tasks.length > 0;
  const declinedAt = Date.parse(data.importDeclinedAt);
  return (
    data.sessions.some((s) => Date.parse(s.endedAt) > declinedAt) ||
    data.tasks.some((t) => Date.parse(t.createdAt) > declinedAt)
  );
}
