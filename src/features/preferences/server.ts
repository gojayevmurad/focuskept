import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { userPreferences } from "@/src/lib/db/schema";
import { localDate } from "@/src/lib/dates";
import {
  defaultSoundSettings,
  defaultWorkHours,
} from "@/src/lib/db/json-types";
import type { Locale } from "@/src/i18n/config";
import type { PreferencesPatch } from "./schema";

export type Preferences = typeof userPreferences.$inferSelect;

/** Defaults for a user whose row has not been created yet (first visit). */
export function defaultPreferences(
  userId: string,
  locale: Locale = "en",
): Preferences {
  const now = new Date();
  return {
    userId,
    locale,
    timezone: "UTC",
    weekStartsOn: 1,
    dailyReminderTime: "08:00",
    workHours: defaultWorkHours,
    reviewSteps: [5, 10, 30],
    defaultTimeTechnique: "pomodoro",
    defaultLearningMethod: "feynman",
    techniqueSettings: {},
    customPresets: [],
    soundSettings: defaultSoundSettings,
    weeklyFocusGoalMinutes: 600,
    emailReviews: true,
    emailWeekly: true,
    streakNudge: false,
    onboardedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function findPreferences(userId: string) {
  const [row] = await db()
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  return row;
}

export async function getPreferences(userId: string, locale?: Locale) {
  return (await findPreferences(userId)) ?? defaultPreferences(userId, locale);
}

/** First visit: store the browser's timezone and UI locale. Never overwrites. */
export async function initPreferences(
  userId: string,
  init: { timezone: string; locale: Locale },
) {
  await db()
    .insert(userPreferences)
    .values({ userId, timezone: init.timezone, locale: init.locale })
    .onConflictDoNothing();
  return getPreferences(userId);
}

export async function updatePreferences(
  userId: string,
  patch: PreferencesPatch,
) {
  const values = {
    ...patch,
    reviewSteps: patch.reviewSteps ? [...patch.reviewSteps] : undefined,
    updatedAt: new Date(),
  };
  const [row] = await db()
    .insert(userPreferences)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userPreferences.userId, set: values })
    .returning();
  return row;
}

export async function markOnboarded(userId: string) {
  await db()
    .update(userPreferences)
    .set({ onboardedAt: sql`coalesce(${userPreferences.onboardedAt}, now())` })
    .where(eq(userPreferences.userId, userId));
}

export function today(prefs: Pick<Preferences, "timezone">, at = new Date()) {
  return localDate(prefs.timezone, at);
}
