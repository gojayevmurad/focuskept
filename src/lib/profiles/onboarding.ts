// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { HEARD_FROM_OPTIONS } from "@/src/lib/attribution/types";
import { heardFromInput } from "@/src/lib/attribution/heard-from";
import { safeRedirect } from "@/src/lib/security/validation";
import { checkBookable, isValidTimeZone } from "@/src/lib/scheduling/slots";

export const FOCUS_AREAS = ["work", "study", "writing", "creative", "life", "job", "coding", "other"] as const;
export const BLOCKERS = ["procrastination", "distractions", "starting", "time", "lonely", "structure"] as const;
export const PREFERRED_TIMES = ["morning", "afternoon", "evening", "night"] as const;
export type PreferredTime = (typeof PREFERRED_TIMES)[number];
const unique = <T,>(values: T[]) => new Set(values).size === values.length;
export const onboardingAnswersSchema = z.object({
  displayName: z.string().max(60),
  age: z.boolean(),
  focusAreas: z.array(z.enum(FOCUS_AREAS)).max(8).refine(unique),
  blockers: z.array(z.enum(BLOCKERS)).max(6).refine(unique),
  preferredTimes: z.array(z.enum(PREFERRED_TIMES)).max(4).refine(unique),
  timezone: z.string().refine(isValidTimeZone),
  duration: z.union([z.literal(25), z.literal(50), z.literal(75)]),
  style: z.enum(["quiet", "chatty"]),
  microphone: z.boolean(),
  weeklyGoal: z.number().int().min(1).max(10),
  heardFrom: z.enum(HEARD_FROM_OPTIONS).optional(),
  heardFromOther: z.string().max(60).optional(),
  startAt: z.iso.datetime().or(z.literal("")),
  reminders: z.boolean(),
  tips: z.boolean(),
  marketing: z.boolean(),
  analytics: z.boolean(),
});
export type OnboardingAnswers = z.infer<typeof onboardingAnswersSchema>;
export const onboardingProgressSchema = z.object({
  version: z.literal(1),
  step: z.number().int().min(0).max(8),
  next: z.string().max(2048).transform(onboardingDestination),
  answers: onboardingAnswersSchema,
});
export type OnboardingProgress = z.infer<typeof onboardingProgressSchema>;

export function onboardingDestination(value?: string | null) {
  const path = safeRedirect(value).replace(/^\/(en|de|fr|nl|es)(?=\/|\?|$)/, "") || "/dashboard";
  // Resolve dot segments before rejecting destinations that would restart setup.
  const normalized = new URL(path, "https://local.invalid");
  if (/^\/(onboarding|sign-in|sign-up|sign-out)(\/|$)/.test(normalized.pathname)) return "/dashboard";
  return safeRedirect(normalized.pathname + normalized.search + normalized.hash);
}

export function initialOnboarding(profile: {
  displayName: string; timezone: string; emailReminders: boolean; emailTips: boolean;
}, saved: unknown, next?: string, analytics = false): OnboardingProgress {
  const parsed = onboardingProgressSchema.safeParse(saved);
  if (parsed.success) return { ...parsed.data, next: next ? onboardingDestination(next) : parsed.data.next };
  return { version: 1, step: 0, next: onboardingDestination(next), answers: {
    displayName: profile.displayName, age: false, focusAreas: [], blockers: [], preferredTimes: [],
    timezone: profile.timezone, duration: 50, style: "quiet", microphone: false, weeklyGoal: 3,
    startAt: "", reminders: profile.emailReminders, tips: profile.emailTips, marketing: false, analytics,
  } };
}

export function validOnboardingStep(step: number, answers: OnboardingAnswers) {
  switch (step) {
    case 0: return Boolean(answers.displayName.trim()) && answers.age;
    case 1: return answers.focusAreas.length > 0;
    case 2: return answers.blockers.length > 0;
    case 3: return answers.preferredTimes.length > 0 && isValidTimeZone(answers.timezone);
    case 4: return [25, 50, 75].includes(answers.duration) && ["quiet", "chatty"].includes(answers.style);
    case 5: return heardFromInput.safeParse(answers).success;
    case 6: return Number.isInteger(answers.weeklyGoal) && answers.weeklyGoal >= 1 && answers.weeklyGoal <= 10;
    case 7: return !answers.startAt || Number.isFinite(Date.parse(answers.startAt));
    case 8: return true;
    default: return false;
  }
}
export function firstInvalidStep(answers: OnboardingAnswers) {
  return Array.from({ length: 9 }, (_, i) => i).find((i) => !validOnboardingStep(i, answers));
}
export function computeFocusPlan(answers: OnboardingAnswers) {
  return { sessions: answers.weeklyGoal, minutes: answers.duration, area: answers.focusAreas[0] ?? "work",
    times: answers.preferredTimes, style: answers.style, support: answers.blockers[0] ?? "starting" };
}

export function timeOfDay(date: Date, timezone: string): PreferredTime {
  const hour = Number(new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(date));
  return hour >= 6 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 22 ? "evening" : "night";
}
export type SuggestedSlot = { startAt: Date; waiting: number; popular: boolean };
export function selectFocusSlots(candidates: SuggestedSlot[], answers: Pick<OnboardingAnswers, "timezone" | "preferredTimes" | "duration">,
  bookings: { startAt: Date; durationMin: number }[] = [], now = new Date()) {
  return candidates.filter((slot) => checkBookable(slot.startAt, answers.duration, now).ok &&
    answers.preferredTimes.includes(timeOfDay(slot.startAt, answers.timezone)) &&
    !bookings.some((booking) => slot.startAt.getTime() < booking.startAt.getTime() + booking.durationMin * 60000 &&
      slot.startAt.getTime() + answers.duration * 60000 > booking.startAt.getTime()))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()).slice(0, 3);
}

export function welcomePhase(profile: { onboardedAt: Date | null; onboardingState: unknown; welcomeVideoSeenAt: Date | null; tourAnsweredAt: Date | null }) {
  if (!profile.onboardedAt || !profile.onboardingState || profile.tourAnsweredAt) return "done";
  return profile.welcomeVideoSeenAt ? "tour" : "video";
}
