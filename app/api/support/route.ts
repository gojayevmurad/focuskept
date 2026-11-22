// SPDX-License-Identifier: AGPL-3.0-only
import { headers } from "next/headers";
import { db } from "@/src/lib/db";
import { supportTicket } from "@/src/lib/db/schema";
import { getSession } from "@/src/lib/auth/session";
import { supportTicketSchema } from "@/src/lib/support/validation";
import { checkSupportRateLimit } from "@/src/lib/support/rate-limit";
import { notifyAdminsOfTicket } from "@/src/lib/support/email";
import { logger } from "@/src/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }

    const parsed = supportTicketSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { name, email, category, subject, message, locale, pageUrl, hp } =
      parsed.data;

    // Check honeypot: bots that fill hidden fields are marked as spam
    const isSpam = Boolean(hp && hp.trim().length > 0);

    const reqHeaders = await headers();
    const forwardedFor = reqHeaders.get("x-forwarded-for");
    const ip =
      (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
      reqHeaders.get("cf-connecting-ip") ||
      reqHeaders.get("x-real-ip") ||
      "127.0.0.1";

    const session = await getSession();
    const userId = session?.user?.id ?? null;

    // Enforce rate limit (5 tickets/hour per IP hash and per user)
    const allowed = await checkSupportRateLimit(ip, userId);
    if (!allowed) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }

    const ticketId = crypto.randomUUID();
    const now = new Date();

    await db()
      .insert(supportTicket)
      .values({
        id: ticketId,
        userId,
        email,
        name,
        category,
        subject,
        message,
        locale,
        pageUrl,
        status: isSpam ? "spam" : "open",
        createdAt: now,
        updatedAt: now,
      });

    // Notify administrators if legitimate submission
    if (!isSpam) {
      void notifyAdminsOfTicket({
        id: ticketId,
        name,
        email,
        category,
        subject,
        message,
        pageUrl,
      });
    }

    return Response.json({ ok: true, id: ticketId });
  } catch (error) {
    logger.error({ err: error }, "Support ticket creation failed");
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
