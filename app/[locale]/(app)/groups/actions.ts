// SPDX-License-Identifier: AGPL-3.0-only
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { requireAppUser } from "@/src/lib/app-user";
import {
  COMMUNITY_KINDS,
  joinCommunity,
  createCommunity,
  joinByCode,
  leaveCommunity,
  removeMember,
  rotateJoinCode,
} from "@/src/lib/community";
import {
  createPost,
  setAutomaticWins,
  cheerPost,
  deletePost,
  reportPost,
} from "@/src/lib/community/feed";
import { redirect } from "@/src/i18n/navigation";

export async function createGroup(_prev: { error?: string }, form: FormData) {
  const { user } = await requireAppUser();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(400),
      kind: z.enum(COMMUNITY_KINDS),
    })
    .safeParse({
      name: form.get("name"),
      description: form.get("description") ?? "",
      kind: form.get("kind"),
    });
  if (!parsed.success) return { error: "invalid" };
  const slug = await createCommunity(user.id, parsed.data);
  redirect({ href: `/groups/${slug}`, locale: await getLocale() });
  return {};
}

export async function joinGroupByCode(
  _prev: { error?: string },
  form: FormData,
) {
  const { user } = await requireAppUser();
  const raw = String(form.get("code") ?? "").trim();
  const code = raw.includes("/") ? raw.split("/").filter(Boolean).at(-1)! : raw;
  const slug = await joinByCode(code.slice(0, 40), user.id);
  if (!slug) return { error: "notFound" };
  redirect({ href: `/groups/${slug}`, locale: await getLocale() });
  return {};
}

export async function leaveGroup(communityId: string) {
  const { user } = await requireAppUser();
  await leaveCommunity(z.string().uuid().parse(communityId), user.id);
  revalidatePath("/[locale]/groups", "layout");
}

export async function removeFromGroup(communityId: string, userId: string) {
  const { user } = await requireAppUser();
  await removeMember(
    z.string().uuid().parse(communityId),
    user.id,
    z.string().max(100).parse(userId),
  );
  revalidatePath("/[locale]/groups", "layout");
}

export async function newInviteCode(communityId: string) {
  const { user } = await requireAppUser();
  await rotateJoinCode(z.string().uuid().parse(communityId), user.id);
  revalidatePath("/[locale]/groups", "layout");
}

export async function publishPost(
  _prev: { error?: string; ok?: boolean },
  form: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const { user } = await requireAppUser();
  const result = await createPost(user.id, Object.fromEntries(form));
  revalidatePath("/[locale]/groups", "layout");
  return result;
}
export async function saveAutomaticWins(
  _prev: { error?: string; ok?: boolean },
  form: FormData,
) {
  const { user } = await requireAppUser();
  await setAutomaticWins(user.id, form.get("enabled") === "on");
  revalidatePath("/[locale]/groups", "layout");
  return { ok: true };
}
export async function reactToPost(postId: string, cheer: boolean) {
  const { user } = await requireAppUser();
  await cheerPost(user.id, z.uuid().parse(postId), cheer);
  revalidatePath("/[locale]/groups", "layout");
}
export async function removePost(postId: string) {
  const { user } = await requireAppUser();
  await deletePost(user.id, z.uuid().parse(postId));
  revalidatePath("/[locale]/groups", "layout");
}
export async function flagPost(
  _prev: { error?: string; ok?: boolean },
  form: FormData,
) {
  const { user } = await requireAppUser();
  const ok = await reportPost(user.id, Object.fromEntries(form));
  revalidatePath("/[locale]/groups", "layout");
  return ok ? { ok: true } : { error: "reportFailed" };
}
export async function joinCircle(communityId: string) {
  const { user } = await requireAppUser();
  await joinCommunity(z.uuid().parse(communityId), user.id);
  revalidatePath("/[locale]/groups", "layout");
}
