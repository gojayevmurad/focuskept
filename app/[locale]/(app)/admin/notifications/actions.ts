// SPDX-License-Identifier: AGPL-3.0-only
"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/app-user";
import { ADMIN_ALERT_EVENTS } from "@/src/lib/db/schema";
import { sendAdminTestEmail, setAdminAlertPreference } from "@/src/lib/admin/alerts";

export async function saveAlertPreferences(form: FormData) {
  const { user } = await requireAdmin();
  for (const event of ADMIN_ALERT_EVENTS) await setAdminAlertPreference(user.id, event, form.get(event) === "on");
  revalidatePath("/admin/notifications", "page");
}
export async function testAlertEmail(): Promise<{ sent: boolean }> {
  const { user, profile } = await requireAdmin();
  return { sent: await sendAdminTestEmail(user, profile.locale) };
}
