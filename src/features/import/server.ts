import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { focusSession, task } from "@/src/lib/db/schema";
import {
  correctClockSkew,
  MIN_COMPLETED_SECONDS,
} from "@/src/features/sessions/schema";
import type { ImportPayload } from "./schema";

/**
 * Imports a visitor's local Work-mode data into their account. Idempotent:
 * the (user, client_id) unique indexes make retries and double clicks no-ops.
 */
export async function importLocalData(userId: string, payload: ImportPayload) {
  return db().transaction(async (tx) => {
    let tasks = 0;
    if (payload.tasks.length) {
      const inserted = await tx
        .insert(task)
        .values(
          payload.tasks.map((t) => ({
            id: crypto.randomUUID(),
            userId,
            clientId: t.clientId,
            title: t.title,
            tags: t.tags,
            status: t.status,
            createdAt: new Date(t.createdAt),
            completedAt:
              t.status === "done"
                ? new Date(t.completedAt ?? t.createdAt)
                : null,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: task.id });
      tasks = inserted.length;
    }
    const clientIds = [
      ...new Set(payload.sessions.map((s) => s.taskClientId).filter(Boolean)),
    ] as string[];
    const owned = clientIds.length
      ? await tx
          .select({ id: task.id, clientId: task.clientId })
          .from(task)
          .where(
            and(eq(task.userId, userId), inArray(task.clientId, clientIds)),
          )
      : [];
    const taskIds = new Map(owned.map((t) => [t.clientId, t.id]));
    let sessions = 0;
    for (let i = 0; i < payload.sessions.length; i += 500) {
      const chunk = payload.sessions.slice(i, i + 500);
      const inserted = await tx
        .insert(focusSession)
        .values(
          chunk.map((s) => ({
            id: crypto.randomUUID(),
            userId,
            clientId: s.clientId,
            mode: "work" as const,
            timeTechnique: s.timeTechnique,
            planningTechnique: s.planningTechnique ?? null,
            taskId: (s.taskClientId && taskIds.get(s.taskClientId)) || null,
            goal: s.goal,
            ...correctClockSkew(s.startedAt, s.endedAt),
            focusedSeconds: s.focusedSeconds,
            breakSeconds: s.breakSeconds,
            cyclesCompleted: s.cyclesCompleted,
            interruptions: s.interruptions,
            overrunSeconds: s.overrunSeconds,
            focusRating: s.focusRating,
            note: s.note || null,
            completed: s.focusedSeconds >= MIN_COMPLETED_SECONDS,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: focusSession.id });
      sessions += inserted.length;
    }
    return { tasks, sessions };
  });
}
