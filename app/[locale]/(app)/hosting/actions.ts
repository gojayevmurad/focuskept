// SPDX-License-Identifier: AGPL-3.0-only
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/src/lib/app-user";
import {
  applyToHost,
  cancelGroupSession,
  createGroupSession,
} from "@/src/lib/hosts";

export type HostState = { ok?: boolean; error?: string };

export async function apply(
  _prev: HostState,
  form: FormData,
): Promise<HostState> {
  const { user } = await requireAppUser();
  const parsed = z
    .object({
      pitch: z.string().trim().min(20).max(800),
      audienceUrl: z.union([z.literal(""), z.url().max(300)]),
    })
    .safeParse({
      pitch: form.get("pitch"),
      audienceUrl: form.get("audienceUrl") ?? "",
    });
  if (!parsed.success) return { error: "invalid" };
  const result = await applyToHost(
    user.id,
    parsed.data.pitch,
    parsed.data.audienceUrl || null,
  );
  revalidatePath("/[locale]/hosting", "page");
  return result.ok ? { ok: true } : { error: result.reason };
}

export async function scheduleGroup(
  _prev: HostState,
  form: FormData,
): Promise<HostState> {
  const { user } = await requireAppUser();
  const parsed = z
    .object({
      startAt: z.string().datetime(),
      duration: z.coerce.number().int(),
      title: z.string().trim().min(3).max(80),
      capacity: z.coerce.number().int().min(2).max(9),
    })
    .safeParse({
      startAt: form.get("startAt"),
      duration: form.get("duration"),
      title: form.get("title"),
      capacity: form.get("capacity"),
    });
  if (!parsed.success) return { error: "invalid" };
  const result = await createGroupSession({
    hostId: user.id,
    startAt: new Date(parsed.data.startAt),
    durationMin: parsed.data.duration,
    title: parsed.data.title,
    capacity: parsed.data.capacity,
  });
  revalidatePath("/[locale]/hosting", "page");
  return result.ok ? { ok: true } : { error: result.reason };
}

export async function cancelHosted(sessionId: string) {
  const { user } = await requireAppUser();
  await cancelGroupSession(user.id, z.string().uuid().parse(sessionId));
  revalidatePath("/[locale]/hosting", "page");
}
