// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { createTranslator } from "next-intl";
import { routing } from "@/src/i18n/routing";
import { EmailLayout } from "@/src/lib/notifications/email-layout";
import { emailBrand } from "@/src/lib/email/brand";
import { getAppConfig } from "@/src/config/app";
import { signUnsubscribeToken } from "./tokens";

type Messages = typeof import("@/messages/en.json");

// Static paths so the worker bundle (esbuild) includes every locale file too.
const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  en: () => import("@/messages/en.json"),
  de: () => import("@/messages/de.json"),
  fr: () => import("@/messages/fr.json"),
  nl: () => import("@/messages/nl.json"),
  es: () => import("@/messages/es.json"),
};

/** Loads the lifecycle email strings for a locale, falling back to English. */
export async function getLifecycleTranslator(locale = "en") {
  const supported =
    (routing.locales as readonly string[]).includes(locale) &&
    locale in loaders;
  const lang = supported ? locale : routing.defaultLocale;
  const messages = (await loaders[lang]()).default as Messages;
  return createTranslator({ locale: lang, messages, namespace: "lifecycle" });
}

export function buildUnsubscribeUrl(userId: string): string {
  const app = getAppConfig();
  const token = signUnsubscribeToken(userId);
  return `${app.url}/api/email/unsubscribe?token=${token}`;
}

export async function renderLifecycleEmail(
  kind:
    | "welcome"
    | "nudge_first_booking"
    | "first_session_tips"
    | "after_first_session"
    | "win_back"
    | "weekly_summary",
  recipient: {
    userId: string;
    email: string;
    name: string;
    locale: string;
  },
  extra?: {
    bookingUrl?: string;
    sessionStats?: { sessions: number; hours: number };
    nextBookingFormatted?: string | null;
    suggestedSlotFormatted?: string | null;
  },
) {
  const app = getAppConfig();
  const t = await getLifecycleTranslator(recipient.locale);
  const unsubscribeUrl = buildUnsubscribeUrl(recipient.userId);
  const named = { appName: app.name };
  const footerText = `${t("footer.why", named)} ${t("footer.settings")}.`;
  const unsubscribeLabel = t("footer.unsubscribe");

  let subject = "";
  let heading = "";
  let lines: string[] = [];
  let cta = { label: "", url: "" };

  switch (kind) {
    case "welcome": {
      subject = t("welcome.subject", named);
      heading = t("welcome.heading", named);
      lines = [
        t("welcome.line1", named),
        t("welcome.line2"),
        t("welcome.line3"),
      ];
      cta = { label: t("welcome.cta"), url: `${app.url}/book` };
      break;
    }
    case "nudge_first_booking": {
      subject = t("nudgeFirstBooking.subject");
      heading = t("nudgeFirstBooking.heading");
      lines = [
        t("nudgeFirstBooking.line1", named),
        t("nudgeFirstBooking.line2"),
        t("nudgeFirstBooking.line3"),
      ];
      cta = { label: t("nudgeFirstBooking.cta"), url: `${app.url}/book` };
      break;
    }
    case "first_session_tips": {
      subject = t("firstSessionTips.subject");
      heading = t("firstSessionTips.heading");
      lines = [
        t("firstSessionTips.line1"),
        t("firstSessionTips.line2"),
        t("firstSessionTips.line3"),
        t("firstSessionTips.line4"),
      ];
      cta = {
        label: t("firstSessionTips.cta"),
        url: extra?.bookingUrl || `${app.url}/dashboard`,
      };
      break;
    }
    case "after_first_session": {
      subject = t("afterFirstSession.subject");
      heading = t("afterFirstSession.heading");
      lines = [
        t("afterFirstSession.line1"),
        t("afterFirstSession.line2"),
        t("afterFirstSession.line3"),
      ];
      cta = { label: t("afterFirstSession.cta"), url: `${app.url}/book` };
      break;
    }
    case "win_back": {
      subject = t("winBack.subject");
      heading = t("winBack.heading");
      lines = [
        t("winBack.line1", named),
        t("winBack.line2"),
        t("winBack.line3"),
      ];
      cta = { label: t("winBack.cta"), url: `${app.url}/book` };
      break;
    }
    case "weekly_summary": {
      subject = t("weeklySummary.subject");
      heading = t("weeklySummary.heading");
      const sessions = extra?.sessionStats?.sessions ?? 0;
      const hours = extra?.sessionStats?.hours ?? 0;
      const statsLine = t("weeklySummary.statsLine", { sessions, hours });
      const nextLine = extra?.nextBookingFormatted
        ? t("weeklySummary.nextBookingLine", {
            when: extra.nextBookingFormatted,
          })
        : t("weeklySummary.noUpcomingLine");
      lines = [statsLine, nextLine];
      if (extra?.suggestedSlotFormatted) {
        lines.push(
          t("weeklySummary.suggestedSlotLine", {
            when: extra.suggestedSlotFormatted,
          }),
        );
      }
      cta = { label: t("weeklySummary.cta"), url: `${app.url}/dashboard` };
      break;
    }
  }

  const text = [
    heading,
    ...lines,
    `${cta.label}: ${cta.url}`,
    `---`,
    footerText,
    `${unsubscribeLabel}: ${unsubscribeUrl}`,
  ].join("\n\n");

  const react = EmailLayout({
    brand: emailBrand(app),
    lang: (routing.locales as readonly string[]).includes(recipient.locale)
      ? recipient.locale
      : routing.defaultLocale,
    preview: lines[0] ?? heading,
    heading,
    lines,
    cta,
    footer: footerText,
    unsubscribeUrl,
    unsubscribeLabel,
  });

  return {
    to: recipient.email,
    subject,
    kind,
    url: cta.url,
    text,
    react,
    unsubscribeUrl,
  };
}
