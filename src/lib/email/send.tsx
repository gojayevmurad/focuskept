// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { Resend } from "resend";
import { getEnv } from "@/src/config/env";
import { getAppConfig } from "@/src/config/app";
import { emailBrand } from "@/src/lib/email/brand";
import { EmailLayout } from "@/src/lib/notifications/email-layout";
import { db } from "@/src/lib/db";
import { emailPreview } from "@/src/lib/db/schema";
import { logger } from "@/src/lib/logger";
export async function sendAuthEmail(
  to: string,
  url: string,
  kind: "verification" | "reset",
) {
  const env = getEnv();
  if (env.EMAIL_MODE === "preview") {
    await db()
      .insert(emailPreview)
      .values({ id: crypto.randomUUID(), recipient: to, url, kind });
    logger.info({ kind }, "Email saved to development email inbox");
    return;
  }
  const title =
    kind === "verification" ? "Verify your email" : "Reset your password";
  const line =
    "Use the secure link below to continue. If you did not request this, ignore this email.";
  const result = await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: title,
    text: [title, line, `${title}: ${url}`].join("\n\n"),
    react: EmailLayout({
      brand: emailBrand(getAppConfig()),
      preview: line,
      heading: title,
      lines: [line],
      cta: { label: title, url },
    }),
  });
  if (result.error) {
    logger.error({ code: result.error.name }, "Email delivery failed");
    throw new Error("Email could not be sent");
  }
}

/** Product email. In preview mode the message is stored for `pnpm email:inbox`. */
export async function sendEmail(input: {
  to: string;
  subject: string;
  kind: string;
  /** Main link in the message; shown in the local inbox. */
  url: string;
  text: string;
  react: React.ReactElement;
}) {
  const env = getEnv();
  if (env.EMAIL_MODE === "preview") {
    await db().insert(emailPreview).values({
      id: crypto.randomUUID(),
      recipient: input.to,
      url: input.url,
      kind: input.kind,
      subject: input.subject,
      body: input.text,
    });
    return;
  }
  const result = await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    react: input.react,
    text: input.text,
  });
  if (result.error) {
    logger.error(
      { code: result.error.name, kind: input.kind },
      "Email delivery failed",
    );
    throw new Error("Email could not be sent");
  }
}
