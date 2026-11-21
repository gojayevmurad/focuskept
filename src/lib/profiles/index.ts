// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { profile, referral, user } from "@/src/lib/db/schema";
import { adminEmails } from "@/src/config/app";
import { usernameFromName, validateUsername } from "./rules";

export type Profile = typeof profile.$inferSelect;

export const REFERRAL_COOKIE = "ref";

export function newReferralCode() {
  // 8 chars from an unambiguous alphabet.
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export async function getProfile(userId: string) {
  const [row] = await db()
    .select()
    .from(profile)
    .where(eq(profile.userId, userId));
  return row;
}

export async function getProfileByUsername(username: string) {
  const [row] = await db()
    .select()
    .from(profile)
    .where(sql`lower(${profile.username}) = ${username.toLowerCase()}`);
  return row;
}

export async function getProfileByReferralCode(code: string) {
  const [row] = await db()
    .select()
    .from(profile)
    .where(eq(profile.referralCode, code.toLowerCase()));
  return row;
}

export async function isUsernameTaken(username: string, exceptUserId?: string) {
  const row = await getProfileByUsername(username);
  return Boolean(row && row.userId !== exceptUserId);
}

async function availableUsername(name: string) {
  const base = usernameFromName(name);
  for (let i = 0; i < 20; i++) {
    const candidate =
      i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const check = validateUsername(candidate);
    if (check.ok && !(await isUsernameTaken(check.username)))
      return check.username;
  }
  return `focus-${randomBytes(4).toString("hex")}`;
}

/**
 * Creates the profile the first time a verified user reaches the app. Reads the
 * referral cookie so invite links and personal links get credit.
 */
export async function ensureProfile(account: {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}): Promise<Profile> {
  const existing = await getProfile(account.id);
  if (existing) return existing;

  const jar = await cookies();
  const refCode = jar.get(REFERRAL_COOKIE)?.value;
  const referrer = refCode
    ? await getProfileByReferralCode(refCode)
    : undefined;
  const referredBy =
    referrer && referrer.userId !== account.id ? referrer.userId : null;
  const isAdmin = adminEmails().includes(account.email.toLowerCase());

  const username = await availableUsername(account.name);
  await db().transaction(async (tx) => {
    await tx
      .insert(profile)
      .values({
        userId: account.id,
        username,
        displayName: account.name.slice(0, 60),
        avatarUrl: account.image ?? null,
        referralCode: newReferralCode(),
        referredBy,
        role: isAdmin ? "admin" : "user",
      })
      .onConflictDoNothing();
    if (referredBy)
      await tx
        .insert(referral)
        .values({
          id: crypto.randomUUID(),
          referrerId: referredBy,
          refereeId: account.id,
        })
        .onConflictDoNothing();
  });
  return (await getProfile(account.id))!;
}

export async function userEmail(userId: string) {
  const [row] = await db()
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId));
  return row;
}
