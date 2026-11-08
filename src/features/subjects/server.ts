import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { learningItem, subject } from "@/src/lib/db/schema";
import type { SubjectInput, SubjectPatch } from "./schema";

export type Subject = typeof subject.$inferSelect;

/** Cards of one subject, or without one when `subject` is "none". */
export function subjectCondition(id: string) {
  return id === "none"
    ? isNull(learningItem.subjectId)
    : eq(learningItem.subjectId, id);
}

export async function listSubjects(userId: string) {
  return db()
    .select()
    .from(subject)
    .where(eq(subject.userId, userId))
    .orderBy(asc(subject.name))
    .limit(200);
}

/** Names are unique per user, ignoring case: creating "biology" again returns "Biology". */
export async function createSubject(userId: string, input: SubjectInput) {
  const [row] = await db()
    .insert(subject)
    .values({ id: crypto.randomUUID(), userId, ...input })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const [existing] = await db()
    .select()
    .from(subject)
    .where(
      and(
        eq(subject.userId, userId),
        sql`lower(${subject.name}) = lower(${input.name})`,
      ),
    );
  return existing;
}

export class SubjectNameTaken extends Error {}

export async function updateSubject(
  userId: string,
  id: string,
  patch: SubjectPatch,
) {
  try {
    const [row] = await db()
      .update(subject)
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
      .where(and(eq(subject.userId, userId), eq(subject.id, id)))
      .returning();
    return row;
  } catch (error) {
    // Drizzle wraps the driver error; 23505 is a unique violation.
    const cause = (error as { cause?: { code?: string } }).cause;
    if (cause?.code === "23505") throw new SubjectNameTaken();
    throw error;
  }
}

/** Cards and sessions keep their content and simply lose the subject. */
export async function deleteSubject(userId: string, id: string) {
  const deleted = await db()
    .delete(subject)
    .where(and(eq(subject.userId, userId), eq(subject.id, id)))
    .returning({ id: subject.id });
  return deleted.length > 0;
}

/** The id when the user owns that subject, otherwise null. */
export async function ownedSubjectId(
  userId: string,
  id: string | null | undefined,
) {
  if (!id) return null;
  const [row] = await db()
    .select({ id: subject.id })
    .from(subject)
    .where(and(eq(subject.userId, userId), eq(subject.id, id)));
  return row?.id ?? null;
}
