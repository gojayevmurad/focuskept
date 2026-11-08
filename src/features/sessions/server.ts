import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  focusSession,
  learningDraft,
  learningItem,
  project,
  subject,
  task,
} from "@/src/lib/db/schema";
import { localDate } from "@/src/lib/dates";
import { captureProductEvent } from "@/src/features/analytics/server";
import { markOnboarded } from "@/src/features/preferences/server";
import type { RecommendationSession } from "@/src/features/techniques/recommend";
import {
  correctClockSkew,
  MIN_COMPLETED_SECONDS,
  type SessionCreate,
} from "./schema";
import { computeStreak, STREAK_MIN_SECONDS } from "./streak";

export type FocusSession = typeof focusSession.$inferSelect;

/**
 * Saves a finished session. Idempotent per (user, clientId): offline retries
 * and the anonymous import never create duplicates.
 */
export async function createSession(userId: string, input: SessionCreate) {
  const result = await db().transaction(async (tx) => {
    let taskId: string | null = null;
    let projectId: string | null = null;
    if (input.taskId) {
      const [owned] = await tx
        .select({ id: task.id, projectId: task.projectId })
        .from(task)
        .where(and(eq(task.userId, userId), eq(task.id, input.taskId)));
      taskId = owned?.id ?? null;
      projectId = owned?.projectId ?? null;
    }
    // Ids the user doesn't own are dropped, like an unknown task.
    if (input.projectId) {
      const [owned] = await tx
        .select({ id: project.id })
        .from(project)
        .where(
          and(eq(project.userId, userId), eq(project.id, input.projectId)),
        );
      projectId = owned?.id ?? projectId;
    }
    let subjectId: string | null = null;
    if (input.mode === "learning" && input.subjectId) {
      const [owned] = await tx
        .select({ id: subject.id })
        .from(subject)
        .where(
          and(eq(subject.userId, userId), eq(subject.id, input.subjectId)),
        );
      subjectId = owned?.id ?? null;
    }
    const [inserted] = await tx
      .insert(focusSession)
      .values({
        id: crypto.randomUUID(),
        userId,
        clientId: input.clientId,
        mode: input.mode,
        timeTechnique: input.timeTechnique,
        learningMethod: input.learningMethod ?? null,
        planningTechnique: input.planningTechnique ?? null,
        taskId,
        projectId: input.mode === "work" ? projectId : null,
        subjectId,
        goal: input.goal,
        ...correctClockSkew(input.startedAt, input.endedAt),
        focusedSeconds: input.focusedSeconds,
        breakSeconds: input.breakSeconds,
        cyclesCompleted: input.cyclesCompleted,
        interruptions: input.interruptions,
        overrunSeconds: input.overrunSeconds,
        focusRating: input.focusRating ?? null,
        note: input.note || null,
        completed: input.focusedSeconds >= MIN_COMPLETED_SECONDS,
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(focusSession)
        .where(
          and(
            eq(focusSession.userId, userId),
            eq(focusSession.clientId, input.clientId),
          ),
        );
      return { session: existing, created: false };
    }
    if (input.taskDone && taskId)
      await tx
        .update(task)
        .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(task.userId, userId), eq(task.id, taskId)));
    if (input.mode === "learning" && input.learning && input.learningMethod)
      await tx
        .insert(learningDraft)
        .values({
          id: crypto.randomUUID(),
          userId,
          sessionId: inserted.id,
          topic: input.learning.topic,
          subjectId,
          sourceUrl: input.learning.sourceUrl ?? null,
          learningMethod: input.learningMethod,
          notes: input.learning.notes,
        })
        .onConflictDoNothing();
    return { session: inserted, created: true };
  });
  if (result.created && result.session.completed) {
    await captureProductEvent(userId, "core_action_completed", {
      feature: "focus_session",
    });
    const [{ count }] = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(focusSession)
      .where(
        and(eq(focusSession.userId, userId), eq(focusSession.completed, true)),
      );
    if (count === 1) {
      await markOnboarded(userId);
      await captureProductEvent(userId, "onboarding_completed");
    }
    if (input.taskDone)
      await captureProductEvent(userId, "core_action_completed", {
        feature: "task_completed",
      });
  }
  return result;
}

export async function getSession(userId: string, id: string) {
  const [row] = await db()
    .select()
    .from(focusSession)
    .where(and(eq(focusSession.userId, userId), eq(focusSession.id, id)));
  return row;
}

/** Local calendar days with a streak-qualifying session, newest first. */
export async function streakDays(userId: string, timezone: string) {
  const rows = await db().execute<{ day: string }>(sql`
    select distinct to_char((${focusSession.startedAt} at time zone ${timezone})::date, 'YYYY-MM-DD') as day
    from ${focusSession}
    where ${focusSession.userId} = ${userId}
      and ${focusSession.completed}
      and ${focusSession.focusedSeconds} >= ${STREAK_MIN_SECONDS}
      and ${focusSession.startedAt} > now() - interval '400 days'
    order by day desc`);
  return rows.rows.map((r) => r.day);
}

export async function todaySummary(
  userId: string,
  timezone: string,
  now = new Date(),
) {
  const today = localDate(timezone, now);
  const [row] = await db()
    .select({
      seconds: sql<number>`coalesce(sum(${focusSession.focusedSeconds}), 0)::int`,
      sessions: sql<number>`count(*)::int`,
    })
    .from(focusSession)
    .where(
      and(
        eq(focusSession.userId, userId),
        gte(focusSession.startedAt, new Date(now.getTime() - 2 * 86_400_000)),
        sql`(${focusSession.startedAt} at time zone ${timezone})::date = ${today}::date`,
      ),
    );
  const streak = computeStreak(await streakDays(userId, timezone), today);
  return { focusedSeconds: row.seconds, sessions: row.sessions, streak };
}

/** Recent sessions with their task's tags, for the recommendation rules. */
export async function recommendationSessions(
  userId: string,
): Promise<RecommendationSession[]> {
  const rows = await db()
    .select({
      technique: focusSession.timeTechnique,
      rating: focusSession.focusRating,
      tags: task.tags,
      focusedSeconds: focusSession.focusedSeconds,
      breakSeconds: focusSession.breakSeconds,
      cyclesCompleted: focusSession.cyclesCompleted,
    })
    .from(focusSession)
    .leftJoin(task, eq(task.id, focusSession.taskId))
    .where(
      and(eq(focusSession.userId, userId), eq(focusSession.completed, true)),
    )
    .orderBy(desc(focusSession.startedAt))
    .limit(200);
  return rows.map((r) => ({ ...r, tags: r.tags ?? [] }));
}

export type TrailBlock = {
  /** Minutes since local midnight when the block started. */
  startMinute: number;
  focusedMinutes: number;
  kept: boolean;
};

/** Today's focus blocks for the timer's trail; a block is "kept" when it produced a card. */
export async function todayTrail(
  userId: string,
  timezone: string,
  now = new Date(),
): Promise<TrailBlock[]> {
  const today = localDate(timezone, now);
  const rows = await db()
    .select({
      minute: sql<number>`(extract(hour from ${focusSession.startedAt} at time zone ${timezone}) * 60 + extract(minute from ${focusSession.startedAt} at time zone ${timezone}))::int`,
      seconds: focusSession.focusedSeconds,
      card: learningItem.id,
    })
    .from(focusSession)
    .leftJoin(learningItem, eq(learningItem.sessionId, focusSession.id))
    .where(
      and(
        eq(focusSession.userId, userId),
        gte(focusSession.startedAt, new Date(now.getTime() - 2 * 86_400_000)),
        sql`(${focusSession.startedAt} at time zone ${timezone})::date = ${today}::date`,
      ),
    )
    .orderBy(focusSession.startedAt);
  return rows.map((r) => ({
    startMinute: r.minute,
    focusedMinutes: Math.round(r.seconds / 60),
    kept: Boolean(r.card),
  }));
}
