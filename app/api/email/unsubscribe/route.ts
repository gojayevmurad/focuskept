// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { profile } from "@/src/lib/db/schema";
import { getAppConfig } from "@/src/config/app";
import { verifyUnsubscribeToken } from "@/src/lib/lifecycle/tokens";
import { logger } from "@/src/lib/logger";

/**
 * Handles RFC 8058 one-click unsubscribe POST requests from email clients.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const verified = verifyUnsubscribeToken(token);

  if (!verified) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    await db()
      .update(profile)
      .set({ emailTips: false, updatedAt: new Date() })
      .where(eq(profile.userId, verified.userId));

    logger.info({ userId: verified.userId }, "User unsubscribed via RFC 8058 POST");
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId: verified.userId }, "Failed to update emailTips");
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

/**
 * Handles browser clicks on the unsubscribe link.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const verified = verifyUnsubscribeToken(token);
  const app = getAppConfig();

  if (!verified) {
    return NextResponse.redirect(new URL("/unsubscribe?status=invalid", app.url), 303);
  }

  try {
    const [p] = await db()
      .update(profile)
      .set({ emailTips: false, updatedAt: new Date() })
      .where(eq(profile.userId, verified.userId))
      .returning({ locale: profile.locale });

    logger.info({ userId: verified.userId }, "User unsubscribed via browser GET");

    const locale = p?.locale && p.locale !== "en" ? `/${p.locale}` : "";
    return NextResponse.redirect(
      new URL(`${locale}/unsubscribe?status=success`, app.url),
      303,
    );
  } catch (err) {
    logger.error({ err, userId: verified.userId }, "Failed to process unsubscribe");
    return NextResponse.redirect(new URL("/unsubscribe?status=invalid", app.url), 303);
  }
}
