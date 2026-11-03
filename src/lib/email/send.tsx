import "server-only";
import { Resend } from "resend";
import { render } from "react-email";
import { createTranslator } from "next-intl";
import { getEnv } from "@/src/config/env";
import { db } from "@/src/lib/db";
import { emailPreview } from "@/src/lib/db/schema";
import { logger } from "@/src/lib/logger";
import { loadMessages } from "@/src/i18n/messages";
import {
  defaultLocale,
  isLocale,
  localeFromPath,
  type Locale,
} from "@/src/i18n/config";
import { AuthEmail } from "@/src/emails/auth-email";

export type Delivery = {
  to: string;
  subject: string;
  react: React.ReactElement;
  kind: string;
  /** Primary link, stored in the development inbox in preview mode. */
  url: string;
  from?: string;
  headers?: Record<string, string>;
};

/**
 * Sends one email. In preview mode nothing leaves the machine: the primary
 * link is stored in `email_preview` for `pnpm email:inbox`.
 */
export async function deliver(message: Delivery) {
  const env = getEnv();
  if (env.EMAIL_MODE === "preview") {
    await db().insert(emailPreview).values({
      id: crypto.randomUUID(),
      recipient: message.to,
      url: message.url,
      kind: message.kind,
    });
    logger.info(
      { kind: message.kind },
      "Email saved to development email inbox",
    );
    return;
  }
  const [html, text] = await Promise.all([
    render(message.react),
    render(message.react, { plainText: true }),
  ]);
  const result = await new Resend(env.RESEND_API_KEY).emails.send({
    from: message.from ?? env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html,
    text,
    headers: message.headers,
  });
  if (result.error) {
    logger.error(
      { code: result.error.name, kind: message.kind },
      "Email delivery failed",
    );
    throw new Error("Email could not be sent");
  }
}

export async function emailTranslator(locale: Locale) {
  return createTranslator({
    locale,
    messages: await loadMessages(locale),
    namespace: "email",
  });
}

/** Better Auth links carry the page to return to; its first segment is the UI locale. */
export function localeFromAuthUrl(url: string): Locale {
  try {
    const callback = new URL(url).searchParams.get("callbackURL");
    return (callback && localeFromPath(callback)) || defaultLocale;
  } catch {
    return defaultLocale;
  }
}

export async function sendAuthEmail(
  to: string,
  url: string,
  kind: "verification" | "reset",
  locale: string = localeFromAuthUrl(url),
) {
  const lang = isLocale(locale) ? locale : defaultLocale;
  const t = await emailTranslator(lang);
  const copy = {
    subject: t(`${kind}.subject`),
    heading: t(`${kind}.heading`),
    body: t(`${kind}.body`),
    button: t(`${kind}.button`),
    ignore: t(`${kind}.ignore`),
    footer: t("footer.transactional"),
  };
  await deliver({
    to,
    subject: copy.subject,
    kind,
    url,
    react: <AuthEmail locale={lang} url={url} copy={copy} />,
  });
}
