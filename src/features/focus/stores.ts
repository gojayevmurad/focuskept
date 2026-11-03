"use client";
import type { SessionCreate } from "@/src/features/sessions/schema";
import {
  computeStreak,
  STREAK_MIN_SECONDS,
} from "@/src/features/sessions/streak";
import type { RecommendationSession } from "@/src/features/techniques/recommend";
import { addDays, localDate } from "@/src/lib/dates";
import { readLocal, updateLocal, type LocalSession } from "./local-store";

export type StoreTask = {
  id: string;
  title: string;
  tags: string[];
  frog?: boolean;
  estimatedMinutes?: number | null;
};

export type TodaySummary = {
  focusedSeconds: number;
  sessions: number;
  streak: number;
};

export type SaveInput = SessionCreate & {
  /** Timeboxing "move to later". */
  moveTaskToLater?: boolean;
};

export type SaveResult = {
  summary: TodaySummary | null;
  sessionId?: string;
  /** Saved on this device only; it will sync when back online. */
  queued?: boolean;
};

export interface FocusStore {
  kind: "local" | "remote";
  listTasks(): Promise<StoreTask[]>;
  addTask(title: string): Promise<StoreTask>;
  saveSession(input: SaveInput): Promise<SaveResult>;
  recommendationSessions(): Promise<RecommendationSession[]>;
}

const browserZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Visitors: everything stays in localStorage until they sign up. */
export const localStore: FocusStore = {
  kind: "local",
  async listTasks() {
    return readLocal()
      .tasks.filter((t) => t.status === "todo")
      .map((t) => ({ id: t.clientId, title: t.title, tags: t.tags }));
  },
  async addTask(title) {
    const task = {
      clientId: crypto.randomUUID(),
      title: title.trim().slice(0, 200),
      status: "todo" as const,
      tags: [],
      createdAt: new Date().toISOString(),
    };
    updateLocal((d) => ({ ...d, tasks: [...d.tasks, task] }));
    return { id: task.clientId, title: task.title, tags: [] };
  },
  async saveSession(input) {
    const session: LocalSession = {
      clientId: input.clientId,
      mode: "work",
      timeTechnique: input.timeTechnique,
      planningTechnique: input.planningTechnique,
      taskClientId: input.taskId,
      goal: input.goal,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      focusedSeconds: input.focusedSeconds,
      breakSeconds: input.breakSeconds,
      cyclesCompleted: input.cyclesCompleted,
      interruptions: input.interruptions,
      overrunSeconds: input.overrunSeconds,
      focusRating: input.focusRating ?? null,
      note: input.note ?? null,
    };
    const data = updateLocal((d) => ({
      ...d,
      sessions: d.sessions.some((s) => s.clientId === session.clientId)
        ? d.sessions
        : [...d.sessions, session],
      tasks:
        input.taskDone && input.taskId
          ? d.tasks.map((t) =>
              t.clientId === input.taskId
                ? { ...t, status: "done" as const, completedAt: input.endedAt }
                : t,
            )
          : d.tasks,
    }));
    return {
      summary: localSummary(data.sessions),
      sessionId: session.clientId,
    };
  },
  async recommendationSessions() {
    const data = readLocal();
    const tags = new Map(data.tasks.map((t) => [t.clientId, t.tags]));
    return data.sessions.map((s) => ({
      technique: s.timeTechnique,
      rating: s.focusRating,
      tags: (s.taskClientId && tags.get(s.taskClientId)) || [],
      focusedSeconds: s.focusedSeconds,
      breakSeconds: s.breakSeconds,
      cyclesCompleted: s.cyclesCompleted,
    }));
  },
};

export function localSummary(
  sessions: readonly LocalSession[],
  now = new Date(),
): TodaySummary {
  const zone = browserZone();
  const today = localDate(zone, now);
  const todays = sessions.filter(
    (s) =>
      s.focusedSeconds >= 60 &&
      localDate(zone, new Date(s.startedAt)) === today,
  );
  const days = sessions
    .filter((s) => s.focusedSeconds >= STREAK_MIN_SECONDS)
    .map((s) => localDate(zone, new Date(s.startedAt)));
  return {
    focusedSeconds: todays.reduce((sum, s) => sum + s.focusedSeconds, 0),
    sessions: todays.length,
    streak: computeStreak(days, today),
  };
}

// ---- Signed-in users: server is the source of truth, with an offline outbox.

export const OUTBOX_KEY = "focuskept:v1:outbox";

function readOutbox(): SaveInput[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeOutbox(items: SaveInput[]) {
  try {
    if (items.length)
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-200)));
    else localStorage.removeItem(OUTBOX_KEY);
  } catch {}
}

async function postSession(input: SaveInput) {
  const { moveTaskToLater, ...body } = input;
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status >= 500 || response.status === 429)
    throw new Error("retry");
  if (!response.ok) return null; // invalid payload: never retried forever
  const data = (await response.json()) as { id: string; summary: TodaySummary };
  if (moveTaskToLater && input.taskId)
    await fetch(`/api/tasks/${encodeURIComponent(input.taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plannedFor: addDays(localDate(browserZone()), 1),
        status: "todo",
        ivyRank: null,
        size135: null,
      }),
    }).catch(() => {});
  return data;
}

let flushing = false;
/** Retries queued sessions with exponential backoff (1 s … 5 min). */
export async function flushOutbox(attempt = 0): Promise<void> {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return;
  const pending = readOutbox();
  if (!pending.length) return;
  flushing = true;
  const remaining: SaveInput[] = [];
  for (const item of pending) {
    try {
      await postSession(item);
    } catch {
      remaining.push(item);
    }
  }
  writeOutbox(remaining);
  flushing = false;
  if (remaining.length)
    setTimeout(
      () => void flushOutbox(attempt + 1),
      Math.min(300_000, 1000 * 2 ** attempt),
    );
}

export function remoteStore(
  initialTasks: StoreTask[],
  recommendation: RecommendationSession[],
): FocusStore {
  return {
    kind: "remote",
    async listTasks() {
      try {
        const response = await fetch("/api/tasks");
        if (!response.ok) throw new Error();
        const today = localDate(browserZone());
        const rows = (await response.json()) as {
          id: string;
          title: string;
          tags: string[];
          isFrogOn: string | null;
          estimatedMinutes: number | null;
        }[];
        return rows
          .map((t) => ({
            id: t.id,
            title: t.title,
            tags: t.tags,
            frog: t.isFrogOn === today,
            estimatedMinutes: t.estimatedMinutes,
          }))
          .sort((a, b) => Number(Boolean(b.frog)) - Number(Boolean(a.frog)));
      } catch {
        return initialTasks;
      }
    },
    async addTask(title) {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, clientId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error("task");
      const row = (await response.json()) as {
        id: string;
        title: string;
        tags: string[];
      };
      return { id: row.id, title: row.title, tags: row.tags };
    },
    async saveSession(input) {
      try {
        const data = await postSession(input);
        void flushOutbox();
        return { summary: data?.summary ?? null, sessionId: data?.id };
      } catch {
        writeOutbox([
          ...readOutbox().filter((i) => i.clientId !== input.clientId),
          input,
        ]);
        return { summary: null, queued: true };
      }
    },
    async recommendationSessions() {
      return recommendation;
    },
  };
}
