// SPDX-License-Identifier: AGPL-3.0-only
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  hostApplicationInput,
  hostedSessionInput,
} from "@/src/lib/hosts/validation";
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
  const parsed = hostApplicationInput.safeParse({
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
  const parsed = hostedSessionInput.safeParse({
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
