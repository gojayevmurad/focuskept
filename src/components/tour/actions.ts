// SPDX-License-Identifier: AGPL-3.0-only
"use server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { profile } from "@/src/lib/db/schema";
import { requireAppUser } from "@/src/lib/app-user";

export async function dismissWelcomeVideo() {
  const { user } = await requireAppUser();
  await db().update(profile).set({ welcomeVideoSeenAt: new Date() }).where(and(eq(profile.userId, user.id), isNull(profile.welcomeVideoSeenAt)));
}

/** Both answers end the prompt permanently; replay remains available in Settings. */
export async function answerTour(accepted: boolean) {
  const { user } = await requireAppUser();
  if (typeof accepted !== "boolean") throw new Error("Invalid tour answer");
  await db().update(profile).set({ tourAnsweredAt: new Date() }).where(and(eq(profile.userId, user.id), isNull(profile.tourAnsweredAt)));
}
