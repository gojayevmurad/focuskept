"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/src/lib/db";
import { favorite } from "@/src/lib/db/schema";
import { requireAppUser } from "@/src/lib/app-user";
import { getPlan } from "@/src/lib/billing/plan";
import { unblockUser } from "@/src/lib/safety";

export async function toggleFavorite(partnerId: string) {
  const { user } = await requireAppUser();
  const id = z.string().min(1).max(100).parse(partnerId);
  if (id === user.id) return { ok: false as const };
  if ((await getPlan(user.id)).plan !== "plus") return { ok: false as const, reason: "plus" };
  const where = and(eq(favorite.userId, user.id), eq(favorite.partnerId, id));
  const [existing] = await db().select().from(favorite).where(where);
  if (existing) await db().delete(favorite).where(where);
  else await db().insert(favorite).values({ userId: user.id, partnerId: id }).onConflictDoNothing();
  revalidatePath("/[locale]/people", "page");
  return { ok: true as const, favorite: !existing };
}

export async function unblock(targetId: string) {
  const { user } = await requireAppUser();
  await unblockUser(user.id, z.string().min(1).max(100).parse(targetId));
  revalidatePath("/[locale]/people", "page");
  return { ok: true as const };
}
