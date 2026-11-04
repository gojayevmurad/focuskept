import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";
import { db } from "@/src/lib/db";
import { project, task } from "@/src/lib/db/schema";
import type { TaskCreate, TaskUpdate } from "./schema";
import { IVY_LEE_MAX, SLOTS_135 } from "./schema";
import { morningFill } from "./planning";

export type Task = typeof task.$inferSelect;
export type Project = typeof project.$inferSelect;

/** Domain errors surface to the API as 409 with a stable code. */
export class TaskRuleError extends Error {
  constructor(public code: "slot_full" | "ivy_full" | "project_not_found") {
    super(code);
  }
}

export async function listTasks(
  userId: string,
  opts: { includeDone?: boolean; includeArchived?: boolean } = {},
) {
  const conditions = [eq(task.userId, userId)];
  if (!opts.includeArchived) conditions.push(ne(task.status, "archived"));
  if (!opts.includeDone) conditions.push(ne(task.status, "done"));
  return db()
    .select()
    .from(task)
    .where(and(...conditions))
    .orderBy(asc(task.sortOrder), desc(task.createdAt))
    .limit(500);
}

/** Tasks completed on a given local day (for "today" views). */
export async function listDoneOn(
  userId: string,
  timezone: string,
  date: string,
) {
  return db()
    .select()
    .from(task)
    .where(
      and(
        eq(task.userId, userId),
        eq(task.status, "done"),
        sql`(${task.completedAt} at time zone ${timezone})::date = ${date}::date`,
      ),
    )
    .orderBy(desc(task.completedAt))
    .limit(100);
}

export async function getTask(userId: string, id: string) {
  const [row] = await db()
    .select()
    .from(task)
    .where(and(eq(task.userId, userId), eq(task.id, id)));
  return row;
}

async function assertProject(
  userId: string,
  projectId: string | null | undefined,
) {
  if (!projectId) return;
  const [row] = await db()
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.id, projectId)));
  if (!row) throw new TaskRuleError("project_not_found");
}

/** Enforces 1-3-5 slot counts and the Ivy Lee list size for a day. */
async function assertPlanningRules(
  userId: string,
  values: Pick<TaskUpdate, "size135" | "plannedFor" | "ivyRank">,
  excludeId?: string,
) {
  if (values.size135 && values.plannedFor) {
    const [{ count }] = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(task)
      .where(
        and(
          eq(task.userId, userId),
          eq(task.size135, values.size135),
          eq(task.plannedFor, values.plannedFor),
          ne(task.status, "archived"),
          excludeId ? ne(task.id, excludeId) : undefined,
        ),
      );
    if (count >= SLOTS_135[values.size135])
      throw new TaskRuleError("slot_full");
  }
  if (values.ivyRank && values.plannedFor) {
    const [{ count }] = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(task)
      .where(
        and(
          eq(task.userId, userId),
          eq(task.plannedFor, values.plannedFor),
          isNotNull(task.ivyRank),
          ne(task.status, "archived"),
          excludeId ? ne(task.id, excludeId) : undefined,
        ),
      );
    if (count >= IVY_LEE_MAX) throw new TaskRuleError("ivy_full");
  }
}

export async function createTask(userId: string, input: TaskCreate) {
  await assertProject(userId, input.projectId);
  await assertPlanningRules(userId, input);
  // The board shows a new task before this returns, so it keeps the same id.
  const id = input.clientId ?? crypto.randomUUID();
  const inserted = await db()
    .insert(task)
    .values({
      id,
      userId,
      ...input,
      completedAt: input.status === "done" ? new Date() : null,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  // Idempotent retry of the same client-generated task.
  const [existing] = await db()
    .select()
    .from(task)
    .where(
      and(eq(task.userId, userId), eq(task.clientId, input.clientId ?? "")),
    );
  return existing;
}

export async function updateTask(
  userId: string,
  id: string,
  patch: TaskUpdate,
) {
  const current = await getTask(userId, id);
  if (!current) return undefined;
  await assertProject(userId, patch.projectId);
  const next = { ...current, ...patch };
  if (
    patch.size135 !== undefined ||
    patch.plannedFor !== undefined ||
    patch.ivyRank !== undefined
  )
    await assertPlanningRules(
      userId,
      {
        size135:
          patch.size135 !== undefined || patch.plannedFor !== undefined
            ? next.size135
            : null,
        plannedFor: next.plannedFor,
        ivyRank:
          patch.ivyRank !== undefined || patch.plannedFor !== undefined
            ? next.ivyRank
            : null,
      },
      id,
    );
  return db().transaction(async (tx) => {
    // Only one frog per day: moving the frog clears yesterday's choice.
    if (patch.isFrogOn)
      await tx
        .update(task)
        .set({ isFrogOn: null, updatedAt: new Date() })
        .where(
          and(
            eq(task.userId, userId),
            eq(task.isFrogOn, patch.isFrogOn),
            ne(task.id, id),
          ),
        );
    const [row] = await tx
      .update(task)
      .set({
        ...patch,
        completedAt:
          patch.status === undefined
            ? undefined
            : patch.status === "done"
              ? (current.completedAt ?? new Date())
              : null,
        updatedAt: new Date(),
      })
      .where(and(eq(task.userId, userId), eq(task.id, id)))
      .returning();
    return row;
  });
}

export async function deleteTask(userId: string, id: string) {
  const deleted = await db()
    .delete(task)
    .where(and(eq(task.userId, userId), eq(task.id, id)))
    .returning({ id: task.id });
  return deleted.length > 0;
}

/**
 * Ivy Lee: unfinished tasks from an earlier day's list roll over to `today`,
 * keeping their order and ahead of anything newly planned. Idempotent.
 */
export async function rollOverIvyLee(userId: string, today: string) {
  const stale = await db()
    .select()
    .from(task)
    .where(
      and(
        eq(task.userId, userId),
        isNotNull(task.ivyRank),
        lt(task.plannedFor, today),
        inArray(task.status, ["todo", "doing"]),
      ),
    )
    .orderBy(asc(task.plannedFor), asc(task.ivyRank));
  if (!stale.length) return 0;
  await db().transaction(async (tx) => {
    const current = await tx
      .select()
      .from(task)
      .where(
        and(
          eq(task.userId, userId),
          eq(task.plannedFor, today),
          isNotNull(task.ivyRank),
        ),
      )
      .orderBy(asc(task.ivyRank));
    const ordered = [...stale, ...current];
    // Keep the six most important; anything beyond goes back to the backlog.
    for (const [i, row] of ordered.entries())
      await tx
        .update(task)
        .set(
          i < IVY_LEE_MAX
            ? { plannedFor: today, ivyRank: i + 1, updatedAt: new Date() }
            : { ivyRank: null, plannedFor: null, updatedAt: new Date() },
        )
        .where(and(eq(task.userId, userId), eq(task.id, row.id)));
  });
  return stale.length;
}

/**
 * Day board morning fill: today's open tasks without a slot (the Ivy Lee
 * list that became today, a frog picked in the timer) take the free slots,
 * list order first. Tasks that don't fit stay planned for today. Idempotent.
 */
export async function fillTodaySlots(userId: string, today: string) {
  const rows = await db()
    .select()
    .from(task)
    .where(
      and(
        eq(task.userId, userId),
        ne(task.status, "archived"),
        sql`(${task.plannedFor} = ${today} or ${task.isFrogOn} = ${today})`,
      ),
    );
  const moves = morningFill(rows, today);
  for (const move of moves)
    await updateTask(userId, move.id, {
      plannedFor: today,
      size135: move.size135,
      ...(move.size135 === "big" ? { isFrogOn: today } : {}),
    }).catch((error) => {
      // A concurrent request took the slot first: leave this task unslotted.
      if (!(error instanceof TaskRuleError)) throw error;
    });
  return moves.length;
}

export async function listProjects(userId: string) {
  return db()
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(asc(project.name))
    .limit(200);
}

export async function createProject(
  userId: string,
  input: { name: string; color: string },
) {
  const [row] = await db()
    .insert(project)
    .values({ id: crypto.randomUUID(), userId, ...input })
    .returning();
  return row;
}

export async function updateProject(
  userId: string,
  id: string,
  patch: Partial<{ name: string; color: string; archived: boolean }>,
) {
  const [row] = await db()
    .update(project)
    .set({
      name: patch.name,
      color: patch.color,
      archivedAt:
        patch.archived === undefined
          ? undefined
          : patch.archived
            ? new Date()
            : null,
      updatedAt: new Date(),
    })
    .where(and(eq(project.userId, userId), eq(project.id, id)))
    .returning();
  return row;
}

export async function deleteProject(userId: string, id: string) {
  const deleted = await db()
    .delete(project)
    .where(and(eq(project.userId, userId), eq(project.id, id)))
    .returning({ id: project.id });
  return deleted.length > 0;
}
