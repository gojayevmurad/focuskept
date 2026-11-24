// SPDX-License-Identifier: AGPL-3.0-only
"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/src/lib/db";
import { analyticsOutbox, profile, user } from "@/src/lib/db/schema";
import { requireAppUser } from "@/src/lib/app-user";
import { isUsernameTaken } from "@/src/lib/profiles";
import { validateUsername } from "@/src/lib/profiles/rules";
import { isValidTimeZone } from "@/src/lib/scheduling/slots";
import { validTags } from "./tags";
import { PREFERRED_TIMES } from "@/src/lib/profiles/onboarding";
import { getPlan } from "@/src/lib/billing/plan";

export type SettingsState = {
  ok?: boolean;
  error?: string;
  analyticsConsent?: boolean;
};

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  username: z.string().trim().max(24),
  bio: z.string().trim().max(280),
  goal: z.string().trim().max(200),
  timezone: z.string().refine(isValidTimeZone),
  segments: z
    .array(
      z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " ").toLowerCase()),
    )
    .refine(validTags),
});

export async function saveProfile(
  _prev: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const { user: me } = await requireAppUser();
  const parsed = profileSchema.safeParse({
    displayName: form.get("displayName"),
    username: form.get("username"),
    bio: form.get("bio") ?? "",
    goal: form.get("goal") ?? "",
    timezone: form.get("timezone"),
    segments: form.getAll("segments"),
  });
  if (!parsed.success) return { error: "invalid" };
  const name = validateUsername(parsed.data.username);
  if (!name.ok)
    return {
      error: name.reason === "reserved" ? "usernameReserved" : "usernameFormat",
    };
  if (await isUsernameTaken(name.username, me.id))
    return { error: "usernameTaken" };
  try {
    await db().transaction(async (tx) => {
      await tx
        .update(profile)
        .set({
          displayName: parsed.data.displayName,
          username: name.username,
          bio: parsed.data.bio,
          goal: parsed.data.goal,
          timezone: parsed.data.timezone,
          segments: parsed.data.segments,
          updatedAt: new Date(),
        })
        .where(eq(profile.userId, me.id));
      await tx
        .update(user)
        .set({ name: parsed.data.displayName })
        .where(eq(user.id, me.id));
    });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    if (
      cause?.code === "23505" ||
      (error as { code?: string }).code === "23505"
    )
      return { error: "usernameTaken" };
    throw error;
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function savePreferences(
  _prev: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const { user: me } = await requireAppUser();
  const section = form.get("section");
  let changes: Partial<typeof profile.$inferInsert>;
  if (section === "focus") {
    const parsed = z
      .object({
        duration: z.coerce.number().refine((n) => [25, 50, 75].includes(n)),
        goal: z.coerce.number().int().min(1).max(10),
        times: z.array(z.enum(PREFERRED_TIMES)).max(4),
      })
      .safeParse({
        duration: form.get("defaultDuration"),
        goal: form.get("weeklyGoal"),
        times: form.getAll("preferredTimes"),
      });
    if (!parsed.success) return { error: "invalid" };
    const plus = (await getPlan(me.id)).plan === "plus";
    changes = {
      defaultDuration: parsed.data.duration,
      weeklyGoal: parsed.data.goal,
      preferredTimes: parsed.data.times,
      microphoneDefault: form.get("microphoneDefault") === "on",
      matchSameSegment: plus && form.get("matchSameSegment") === "on",
    };
  } else if (section === "notifications")
    changes = {
      emailReminders: form.get("emailReminders") === "on",
      pushReminders: form.get("pushReminders") === "on",
      emailTips: form.get("emailTips") === "on",
      emailMarketing: form.get("emailMarketing") === "on",
    };
  else if (section === "privacy")
    changes = { statsPublic: form.get("statsPublic") === "on" };
  else return { error: "invalid" };
  const analyticsConsent =
    section === "privacy" && form.get("analyticsEnabled") === "yes"
      ? form.get("analyticsConsent") === "on"
      : undefined;
  await db().transaction(async (tx) => {
    await tx
      .update(profile)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(profile.userId, me.id));
    if (analyticsConsent !== undefined) {
      await tx.update(user).set({ analyticsConsent }).where(eq(user.id, me.id));
      if (!analyticsConsent)
        await tx
          .delete(analyticsOutbox)
          .where(eq(analyticsOutbox.userId, me.id));
    }
  });
  revalidatePath("/[locale]", "layout");
  return { ok: true, analyticsConsent };
}
export async function checkUsername(value: string) {
  const { user: me } = await requireAppUser();
  const parsed = validateUsername(String(value).slice(0, 25));
  if (!parsed.ok)
    return parsed.reason === "reserved" ? "usernameReserved" : "usernameFormat";
  return (await isUsernameTaken(parsed.username, me.id))
    ? "usernameTaken"
    : "available";
}
