"use client";
import { useCallback, useRef, useState } from "react";
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
  // A new task can be edited before the server has it; those edits wait here.
  const creating = useRef(new Map<string, Promise<ClientTask | null>>());

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
    (input: TaskCreate) => {
      const id = crypto.randomUUID();
      const draft: ClientTask = {
        id,
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
      setTasks((list) => [draft, ...list]);
      const request = send("/api/tasks", "POST", { ...input, clientId: id })
        .then((row: ClientTask) => {
          setTasks((list) => list.map((x) => (x.id === id ? row : x)));
          return row;
        })
        .catch((error: unknown) => {
          setTasks((list) => list.filter((x) => x.id !== id));
          fail(error);
          return null;
        })
        .finally(() => creating.current.delete(id));
      creating.current.set(id, request);
      return request;
    },
    [fail],
  );

  const update = useCallback(
    async (id: string, patch: TaskUpdate) => {
      let before: ClientTask | undefined;
      const apply = () =>
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
      apply();
      const created = creating.current.get(id);
      if (created) {
        if (!(await created)) return false;
        // The server's copy of the new task just replaced this edit.
        apply();
      }
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
      if (creating.current.has(id) && !(await creating.current.get(id))) return;
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
