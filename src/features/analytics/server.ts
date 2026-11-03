import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { user } from "@/src/lib/db/schema";
import { trackServer } from "@/src/lib/analytics/server";
import { logger } from "@/src/lib/logger";
import type {
  AnalyticsEvent,
  EventProperties,
} from "@/src/lib/analytics/events";

/**
 * Authoritative product events are captured server-side only, after the
 * write succeeded, and only for users who consented. Never user text.
 * Analytics failures never fail the user's request.
 */
export async function captureProductEvent(
  userId: string,
  event: AnalyticsEvent,
  properties: EventProperties = {},
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    const [owner] = await db()
      .select({ consent: user.analyticsConsent })
      .from(user)
      .where(eq(user.id, userId));
    await trackServer(userId, event, properties, Boolean(owner?.consent));
  } catch {
    logger.warn({ event }, "Analytics capture failed");
  }
}

export const recordTaskCompleted = (userId: string) =>
  captureProductEvent(userId, "core_action_completed", {
    feature: "task_completed",
  });
