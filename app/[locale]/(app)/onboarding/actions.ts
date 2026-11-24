// SPDX-License-Identifier: AGPL-3.0-only
"use server";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { db } from "@/src/lib/db";
import { analyticsOutbox, profile, user as account } from "@/src/lib/db/schema";
import { requireAppUser } from "@/src/lib/app-user";
import { BookingFailure, createBooking, upcomingBookings } from "@/src/lib/bookings/service";
import { suggestedSlots } from "@/src/lib/bookings/availability";
import { trackForUser } from "@/src/lib/analytics/product";
import { ATTRIBUTION_COOKIE, parseAttributionCookie, sanitizeAttribution, channelFor } from "@/src/lib/attribution";
import { heardFromInput } from "@/src/lib/attribution/heard-from";
import { onboardingProgressSchema, firstInvalidStep, selectFocusSlots, onboardingDestination } from "@/src/lib/profiles/onboarding";
import { redirect } from "@/src/i18n/navigation";

export type OnboardingState = { error?: "invalid" | "booking"; step?: number };

export async function saveOnboarding(input: unknown): Promise<OnboardingState> {
  const { user, profile: me } = await requireAppUser(true);
  const parsed = onboardingProgressSchema.safeParse(input);
  if (!parsed.success || me.onboardedAt) return { error: "invalid" };
  const invalid = firstInvalidStep(parsed.data.answers);
  if (invalid !== undefined && invalid < parsed.data.step) return { error: "invalid", step: invalid };
  await db().update(profile).set({ onboardingState: parsed.data, updatedAt: new Date() })
    .where(and(eq(profile.userId, user.id), isNull(profile.onboardedAt)));
  return {};
}

export async function onboardingSlots(input: unknown) {
  const { user } = await requireAppUser(true);
  const parsed = onboardingProgressSchema.safeParse(input);
  if (!parsed.success || !parsed.data.answers.preferredTimes.length) return [];
  const answers = parsed.data.answers;
  const now = new Date();
  const [candidates, bookings] = await Promise.all([
    suggestedSlots(user.id, answers.duration, now, 48, answers.timezone),
    upcomingBookings(user.id),
  ]);
  return selectFocusSlots(candidates, answers, bookings, now).map((slot) => ({ ...slot, startAt: slot.startAt.toISOString() }));
}

export async function completeOnboarding(_prev: OnboardingState, form: FormData): Promise<OnboardingState> {
  const { user, profile: me } = await requireAppUser(true);
  let input: unknown;
  try { input = JSON.parse(String(form.get("progress"))); } catch { return { error: "invalid" }; }
  const parsed = onboardingProgressSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const progress = parsed.data;
  const invalid = firstInvalidStep(progress.answers);
  if (invalid !== undefined) return { error: "invalid", step: invalid };
  const locale = await getLocale();
  const next = onboardingDestination(progress.next);
  if (me.onboardedAt) { redirect({ href: next, locale }); return {}; }
  const answers = progress.answers;
  const jar = await cookies();
  const attribution = {
    ...sanitizeAttribution(parseAttributionCookie(jar.get(ATTRIBUTION_COOKIE)?.value) ?? {}),
    ...heardFromInput.parse(answers),
  };
  const segmentFor: Record<string, string> = { work: "remote-work", study: "study", writing: "writing", creative: "creative" };
  const segments = [...new Set(answers.focusAreas.flatMap((area) => segmentFor[area] ? [segmentFor[area]] : []))];
  await db().transaction(async (tx) => {
    await tx.update(profile).set({
      displayName: answers.displayName.trim(), timezone: answers.timezone, segments,
      focusAreas: answers.focusAreas, blockers: answers.blockers, preferredTimes: answers.preferredTimes,
      defaultDuration: answers.duration, sessionStyle: answers.style, weeklyGoal: answers.weeklyGoal,
      microphoneDefault: answers.microphone, emailReminders: answers.reminders, pushReminders: answers.reminders,
      emailTips: answers.tips, emailMarketing: answers.marketing,
      birthdateConfirmed: true, ageConfirmedAt: new Date(), onboardedAt: new Date(),
      onboardingState: progress, attribution, updatedAt: new Date(),
    }).where(and(eq(profile.userId, user.id), isNull(profile.onboardedAt)));
    // Reuse the same account consent and outbox semantics as /api/account/consent.
    await tx.update(account).set({ analyticsConsent: answers.analytics }).where(eq(account.id, user.id));
    if (!answers.analytics) await tx.delete(analyticsOutbox).where(eq(analyticsOutbox.userId, user.id));
  });
  jar.delete(ATTRIBUTION_COOKIE);
  const channel = channelFor(attribution);
  void trackForUser(user.id, "onboarding_completed", {
    segments: segments.length, channel, heard_from: attribution.heardFrom,
    $set_once: { initial_channel: channel, initial_source: attribution.source, initial_medium: attribution.medium,
      initial_campaign: attribution.campaign, initial_referrer: attribution.referrer,
      initial_landing_path: attribution.landingPath, heard_from: attribution.heardFrom },
  });
  if (answers.startAt) {
    try {
      await createBooking({ userId: user.id, timeZone: answers.timezone, startAt: new Date(answers.startAt), durationMin: answers.duration });
    } catch (error) {
      if (!(error instanceof BookingFailure)) throw error;
      redirect({ href: `/book?onboarded=1&duration=${answers.duration}`, locale });
      return {};
    }
  }
  redirect({ href: next === "/dashboard" ? "/dashboard?welcome=1" : next, locale });
  return {};
}
