"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/src/lib/app-user";
import { joinChallenge, leaveChallenge } from "@/src/lib/challenges";

export async function toggleChallenge(challengeId: string, join: boolean) {
  const { user } = await requireAppUser();
  const id = z.string().uuid().parse(challengeId);
  if (join) await joinChallenge(id, user.id);
  else await leaveChallenge(id, user.id);
  revalidatePath("/[locale]/challenges", "layout");
}
