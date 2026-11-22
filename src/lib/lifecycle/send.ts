// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { Resend } from "resend";
import { getEnv } from "@/src/config/env";
import { db } from "@/src/lib/db";
import { emailPreview } from "@/src/lib/db/schema";
import { logger } from "@/src/lib/logger";

export type LifecycleEmailPayload = {
  to: string;
  subject: string;
  kind: string;
  url: string;
  text: string;
  react: React.ReactElement;
  unsubscribeUrl: string;
};

/**
 * Delivers lifecycle emails using Resend with RFC 8058 List-Unsubscribe headers.
 * In preview mode (development/test without API keys), saves to `email_preview` table.
 */
export async function sendLifecycleEmail(payload: LifecycleEmailPayload) {
  const env = getEnv();
  const headers = {
    "List-Unsubscribe": `<${payload.unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  if (env.EMAIL_MODE === "preview" || !env.RESEND_API_KEY) {
    await db().insert(emailPreview).values({
      id: crypto.randomUUID(),
      recipient: payload.to,
      url: payload.url,
      kind: payload.kind,
      subject: payload.subject,
      body: payload.text,
    });
    logger.info({ kind: payload.kind, to: payload.to }, "Lifecycle email preview saved");
    return;
  }

  const result = await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    react: payload.react,
    text: payload.text,
    headers,
  });

  if (result.error) {
    logger.error(
      { code: result.error.name, kind: payload.kind, err: result.error },
      "Lifecycle email delivery failed",
    );
    throw new Error("Lifecycle email could not be sent");
  }
}
