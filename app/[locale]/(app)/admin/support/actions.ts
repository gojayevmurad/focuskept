// SPDX-License-Identifier: AGPL-3.0-only
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/src/lib/app-user";
import { updateSupportTicket } from "@/src/lib/support/admin";

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "answered", "closed", "spam"]),
});

const noteSchema = z.object({
  id: z.string().uuid(),
  adminNote: z.string().max(10000),
});

export async function updateTicketStatusAction(formData: FormData) {
  await requireAdmin();
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  await updateSupportTicket(parsed.data.id, { status: parsed.data.status });
  revalidatePath("/[locale]/admin/support", "layout");
  return { ok: true };
}

export async function updateTicketNoteAction(formData: FormData) {
  await requireAdmin();
  const parsed = noteSchema.safeParse({
    id: formData.get("id"),
    adminNote: formData.get("adminNote"),
  });

  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  await updateSupportTicket(parsed.data.id, {
    adminNote: parsed.data.adminNote,
  });
  revalidatePath("/[locale]/admin/support", "layout");
  return { ok: true };
}

export async function updateTicketStatusFormAction(
  formData: FormData,
): Promise<void> {
  await updateTicketStatusAction(formData);
}

export async function updateTicketNoteFormAction(
  formData: FormData,
): Promise<void> {
  await updateTicketNoteAction(formData);
}
