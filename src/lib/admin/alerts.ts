// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@/src/lib/db";
import { adminAlertPref, profile, user, type AdminAlertEvent } from "@/src/lib/db/schema";
import { adminEmails, getAppConfig } from "@/src/config/app";
import { routing } from "@/src/i18n/routing";
import { sendEmail } from "@/src/lib/email/send";
import { emailBrand } from "@/src/lib/email/brand";
import { once } from "@/src/lib/notifications";
import { EmailLayout } from "@/src/lib/notifications/email-layout";
import { logger } from "@/src/lib/logger";

export async function adminAlertRecipients(event: AdminAlertEvent) {
  const emails = adminEmails();
  const admins = await db().select({ id: user.id, email: user.email, locale: profile.locale })
    .from(user).leftJoin(profile, eq(profile.userId, user.id))
    .where(or(eq(profile.role, "admin"), emails.length ? inArray(sql`lower(${user.email})`, emails) : undefined));
  if (!admins.length) return [];
  const prefs = await db().select().from(adminAlertPref)
    .where(and(eq(adminAlertPref.event, event), inArray(adminAlertPref.userId, admins.map((a) => a.id))));
  const disabled = new Set(prefs.filter((p) => !p.enabled).map((p) => p.userId));
  return admins.filter((a) => !disabled.has(a.id));
}

export async function getAdminAlertPreferences(userId: string) {
  const prefs = await db().select().from(adminAlertPref).where(eq(adminAlertPref.userId, userId));
  return Object.fromEntries(prefs.map((p) => [p.event, p.enabled])) as Partial<Record<AdminAlertEvent, boolean>>;
}

export async function setAdminAlertPreference(userId: string, event: AdminAlertEvent, enabled: boolean) {
  await db().insert(adminAlertPref).values({ userId, event, enabled })
    .onConflictDoUpdate({ target: [adminAlertPref.userId, adminAlertPref.event], set: { enabled } });
}

async function translator(locale: string | null) {
  const language = routing.locales.find((l) => l === locale) ?? "en";
  const messages = (await import(`../../../messages/${language}.json`)).default;
  return createTranslator({ locale: language, messages, namespace: "adminAlerts" });
}

/** Call after the owning write commits. Delivery failures never roll back product work. */
export async function sendAdminAlert(event: AdminAlertEvent, refId: string, input: {
  name?: string;
  detail?: string;
  durationMin?: number;
  path?: string;
} = {}) {
  try {
    const app = getAppConfig();
    for (const admin of await adminAlertRecipients(event)) {
      try {
        const t = await translator(admin.locale);
        const values = { name: input.name ?? "", detail: input.detail ?? "", duration: input.durationMin ?? 25, app: app.name };
        const heading = t(`${event}.subject`, values);
        const lines = [t(`${event}.body`, values)];
        const cta = { label: t(event === "match_now_waiting" ? "join" : "open"), url: `${app.url}${input.path ?? "/admin/notifications"}` };
        await once(admin.id, `admin:${event}`, refId, "email", () => sendEmail({
          to: admin.email, subject: heading, kind: `admin:${event}`, url: cta.url,
          text: [heading, ...lines, `${cta.label}: ${cta.url}`].join("\n\n"),
          react: EmailLayout({ brand: emailBrand(app), preview: lines[0], heading, lines, cta, footer: t("footer", { app: app.name }) }),
        }));
      } catch (error) {
        logger.warn({ err: error, event, refId, adminId: admin.id }, "Admin alert failed");
      }
    }
  } catch (error) {
    logger.warn({ err: error, event, refId }, "Admin alert failed");
  }
}

/** Explicit test delivery goes only to the requesting admin, independent of preferences. */
export async function sendAdminTestEmail(admin: { id: string; email: string }, locale: string) {
  try {
    const app = getAppConfig();
    const t = await translator(locale);
    const heading = t("testSubject", { app: app.name });
    const lines = [t("testBody")];
    const cta = { label: t("open"), url: `${app.url}/admin/notifications` };
    return await once(admin.id, "admin:test", crypto.randomUUID(), "email", () => sendEmail({
      to: admin.email, subject: heading, kind: "admin:test", url: cta.url,
      text: [heading, ...lines, `${cta.label}: ${cta.url}`].join("\n\n"),
      react: EmailLayout({ brand: emailBrand(app), preview: lines[0], heading, lines, cta, footer: t("footer", { app: app.name }) }),
    }));
  } catch (error) {
    logger.warn({ err: error, adminId: admin.id }, "Admin test email failed");
    return false;
  }
}
