// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { Resend } from "resend";
import { getEnv } from "@/src/config/env";
import { adminEmails, getAppConfig } from "@/src/config/app";
import { db } from "@/src/lib/db";
import { emailPreview } from "@/src/lib/db/schema";
import { logger } from "@/src/lib/logger";
import { emailBrand } from "@/src/lib/email/brand";
import { EmailLayout } from "@/src/lib/notifications/email-layout";

export async function notifyAdminsOfTicket(ticket: {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  pageUrl?: string;
}) {
  const admins = adminEmails();
  if (!admins.length) return;

  const env = getEnv();
  const app = getAppConfig();
  const title = `[Support: ${ticket.category}] ${ticket.subject}`;
  const lines = [
    `New ticket from: ${ticket.name} <${ticket.email}>`,
    `Category: ${ticket.category}`,
    `Subject: ${ticket.subject}`,
    ticket.pageUrl ? `Page: ${ticket.pageUrl}` : "",
    `Message:`,
    ticket.message,
  ].filter(Boolean);

  const adminUrl = `${app.url}/admin/support/${ticket.id}`;
  const footerText = `This notification was sent to administrators of ${app.name}. Reply directly to this email to contact the sender.`;

  for (const adminEmail of admins) {
    try {
      if (env.EMAIL_MODE === "preview") {
        await db().insert(emailPreview).values({
          id: crypto.randomUUID(),
          recipient: adminEmail,
          kind: "support_ticket",
          url: adminUrl,
          subject: title,
          body: lines.join("\n\n"),
        });
        logger.info(
          { recipient: adminEmail, ticketId: ticket.id },
          "Support ticket email logged in local email inbox",
        );
      } else if (env.EMAIL_MODE === "send" && env.RESEND_API_KEY) {
        await new Resend(env.RESEND_API_KEY).emails.send({
          from: env.EMAIL_FROM,
          to: adminEmail,
          replyTo: ticket.email,
          subject: title,
          text: lines.join("\n\n"),
          react: EmailLayout({
            brand: emailBrand(app),
            preview: `Support: ${ticket.subject}`,
            heading: `Support Ticket: ${ticket.category}`,
            lines,
            cta: { label: "View ticket in admin", url: adminUrl },
            footer: footerText,
          }),
        });
      }
    } catch (error) {
      // Failure to send an email must never block ticket storage or creation.
      logger.warn(
        { err: error, adminEmail, ticketId: ticket.id },
        "Failed to send support ticket email to admin",
      );
    }
  }
}
