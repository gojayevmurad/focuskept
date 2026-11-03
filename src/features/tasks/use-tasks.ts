"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/src/components/ui/toast";
import type { TaskCreate, TaskUpdate } from "./schema";

/** Client shape of a task (dates as strings, as the JSON API returns them). */
export type ClientTask = {
  id: string;
  title: string;
  notes: string | null;
  tags: string[];
  projectId: string | null;
  status: "todo" | "doing" | "done" | "archived";
  priority: number;
  eisenhower: "do" | "schedule" | "delegate" | "delete" | null;
  size135: "big" | "medium" | "small" | null;
  plannedFor: string | null;
  ivyRank: number | null;
  isFrogOn: string | null;
  sortOrder: number;
  estimatedMinutes: number | null;
  completedAt: string | null;
};

export type ClientProject = {
  id: string;
  name: string;
  color: string;
  archivedAt: string | null;
};

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error("request"), {
      code: (data as { error?: string }).error,
    });
  }
  return response.status === 204 ? null : response.json();
}

/** Optimistic task state: the UI updates first, then rolls back on failure. */
export function useTasks(initial: ClientTask[]) {
  const t = useTranslations("tasks.errors");
  const [tasks, setTasks] = useState(initial);
  // A server refresh (e.g. after an import) replaces the optimistic state.
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setTasks(initial);
  }

  const fail = useCallback(
    (error: unknown) => {
      const code = (error as { code?: string }).code;
      toast(
        code === "slot_full"
          ? t("slotFull")
          : code === "ivy_full"
            ? t("ivyFull")
            : t("generic"),
        "error",
      );
    },
    [t],
  );

  const create = useCallback(
    async (input: TaskCreate) => {
      const temp: ClientTask = {
        id: `temp-${crypto.randomUUID()}`,
        title: input.title,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
        projectId: input.projectId ?? null,
        status: input.status ?? "todo",
        priority: input.priority ?? 3,
        eisenhower: input.eisenhower ?? null,
        size135: input.size135 ?? null,
        plannedFor: input.plannedFor ?? null,
        ivyRank: input.ivyRank ?? null,
        isFrogOn: input.isFrogOn ?? null,
        sortOrder: input.sortOrder ?? 0,
        estimatedMinutes: input.estimatedMinutes ?? null,
        completedAt: null,
      };
      setTasks((list) => [temp, ...list]);
      try {
        const row = (await send("/api/tasks", "POST", {
          ...input,
          clientId: crypto.randomUUID(),
        })) as ClientTask;
        setTasks((list) => list.map((x) => (x.id === temp.id ? row : x)));
        return row;
      } catch (error) {
        setTasks((list) => list.filter((x) => x.id !== temp.id));
        fail(error);
        return null;
      }
    },
    [fail],
  );

  const update = useCallback(
    async (id: string, patch: TaskUpdate) => {
      let before: ClientTask | undefined;
      setTasks((list) =>
        list.map((x) => {
          if (x.id === id) before = x;
          if (patch.isFrogOn && x.isFrogOn === patch.isFrogOn && x.id !== id)
            return { ...x, isFrogOn: null };
          return x.id === id
            ? {
                ...x,
                ...patch,
                completedAt:
                  patch.status === "done"
                    ? (x.completedAt ?? new Date().toISOString())
                    : patch.status
                      ? null
                      : x.completedAt,
              }
            : x;
        }),
      );
      try {
        const row = (await send(
          `/api/tasks/${id}`,
          "PATCH",
          patch,
        )) as ClientTask;
        setTasks((list) => list.map((x) => (x.id === id ? row : x)));
        return true;
      } catch (error) {
        if (before)
          setTasks((list) => list.map((x) => (x.id === id ? before! : x)));
        fail(error);
        return false;
      }
    },
    [fail],
  );

  const remove = useCallback(
    async (id: string) => {
      let before: ClientTask[] = [];
      setTasks((list) => {
        before = list;
        return list.filter((x) => x.id !== id);
      });
      try {
        await send(`/api/tasks/${id}`, "DELETE");
      } catch (error) {
        setTasks(before);
        fail(error);
      }
    },
    [fail],
  );

  return { tasks, setTasks, create, update, remove };
}

export async function projectRequest(
  url: string,
  method: string,
  body?: unknown,
) {
  return send(url, method, body);
}
