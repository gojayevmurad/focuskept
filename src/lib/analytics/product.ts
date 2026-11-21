import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { user } from "@/src/lib/db/schema";
import { getEnv } from "@/src/config/env";
import { logger } from "@/src/lib/logger";
import { trackServer } from "./server";
import type { AnalyticsEvent, EventProperties } from "./events";

/** Server-side product event. Sent only when analytics is on and the user opted in. */
export async function trackForUser(
  userId: string,
  event: AnalyticsEvent,
  properties: EventProperties = {},
) {
  if (!getEnv().ANALYTICS_ENABLED) return;
  try {
    const [row] = await db()
      .select({ consent: user.analyticsConsent })
      .from(user)
      .where(eq(user.id, userId));
    if (row?.consent) await trackServer(userId, event, properties, true);
  } catch (error) {
    logger.warn({ err: error, event }, "Analytics event dropped");
  }
}
