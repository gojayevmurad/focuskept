// SPDX-License-Identifier: AGPL-3.0-only
"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/src/lib/db";
import { profile, user } from "@/src/lib/db/schema";
import { requireAppUser } from "@/src/lib/app-user";
import { isUsernameTaken } from "@/src/lib/profiles";
import { isSegment, validateUsername } from "@/src/lib/profiles/rules";
import { isValidTimeZone } from "@/src/lib/scheduling/slots";
import { getPlan } from "@/src/lib/billing/plan";

export type SettingsState = { ok?: boolean; error?: string };

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  username: z.string().trim().max(24),
  bio: z.string().trim().max(280),
  goal: z.string().trim().max(200),
  timezone: z.string().refine(isValidTimeZone),
  avatarUrl: z.union([z.literal(""), z.url().startsWith("https://").max(500)]),
  segments: z.array(z.string().refine(isSegment)).max(8),
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
    avatarUrl: form.get("avatarUrl") ?? "",
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
  await db()
    .update(profile)
    .set({
      displayName: parsed.data.displayName,
      username: name.username,
      bio: parsed.data.bio,
      goal: parsed.data.goal,
      timezone: parsed.data.timezone,
      avatarUrl: parsed.data.avatarUrl || null,
      segments: parsed.data.segments,
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, me.id));
  await db()
    .update(user)
    .set({ name: parsed.data.displayName })
    .where(eq(user.id, me.id));
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function savePreferences(
  _prev: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const { user: me } = await requireAppUser();
  const plus = (await getPlan(me.id)).plan === "plus";
  await db()
    .update(profile)
    .set({
      emailReminders: form.get("emailReminders") === "on",
      pushReminders: form.get("pushReminders") === "on",
      microphoneDefault: form.get("microphoneDefault") === "on",
      // Advanced matching filters are a Plus feature.
      matchSameSegment: plus && form.get("matchSameSegment") === "on",
      statsPublic: form.get("statsPublic") === "on",
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, me.id));
  revalidatePath("/[locale]/settings", "page");
  return { ok: true };
}
