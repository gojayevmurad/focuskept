import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  focusSession,
  learningItem,
  project,
  question,
  review,
  reviewAnswer,
  task,
  user,
  userPreferences,
} from "@/src/lib/db/schema";

/** Everything FocusKept stores about the user (data portability). */
export async function exportAll(userId: string) {
  const [profile] = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      analyticsConsent: user.analyticsConsent,
    })
    .from(user)
    .where(eq(user.id, userId));
  const [preferences] = await db()
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  const cards = await db()
    .select()
    .from(learningItem)
    .where(eq(learningItem.userId, userId))
    .orderBy(asc(learningItem.createdAt));
  const cardIds = cards.map((c) => c.id);
  const reviews = await db()
    .select()
    .from(review)
    .where(eq(review.userId, userId))
    .orderBy(asc(review.completedAt));
  const reviewIds = reviews.map((r) => r.id);
  return {
    exportedAt: new Date().toISOString(),
    profile,
    preferences: preferences ?? null,
    projects: await db()
      .select()
      .from(project)
      .where(eq(project.userId, userId)),
    tasks: await db()
      .select()
      .from(task)
      .where(eq(task.userId, userId))
      .orderBy(asc(task.createdAt)),
    sessions: await db()
      .select()
      .from(focusSession)
      .where(eq(focusSession.userId, userId))
      .orderBy(asc(focusSession.startedAt)),
    cards: cards.map(({ search: _search, ...card }) => {
      void _search;
      return card;
    }),
    questions: cardIds.length
      ? await db()
          .select()
          .from(question)
          .where(inArray(question.learningItemId, cardIds))
      : [],
    reviews,
    reviewAnswers: reviewIds.length
      ? await db()
          .select()
          .from(reviewAnswer)
          .where(inArray(reviewAnswer.reviewId, reviewIds))
      : [],
  };
}

export const CSV_COLUMNS = {
  sessions: [
    "id",
    "mode",
    "timeTechnique",
    "learningMethod",
    "planningTechnique",
    "goal",
    "startedAt",
    "endedAt",
    "focusedSeconds",
    "breakSeconds",
    "cyclesCompleted",
    "interruptions",
    "overrunSeconds",
    "focusRating",
    "note",
    "completed",
  ],
  cards: [
    "id",
    "topic",
    "learningMethod",
    "status",
    "sourceUrl",
    "explanation",
    "currentStep",
    "intervalDays",
    "dueOn",
    "reviewCount",
    "lapseCount",
    "createdAt",
  ],
  reviews: [
    "id",
    "learningItemId",
    "scheduledOn",
    "completedAt",
    "scorePct",
    "passed",
    "stepBefore",
    "stepAfter",
    "nextDueOn",
    "wasRelearn",
    "wasEarly",
  ],
} as const;
