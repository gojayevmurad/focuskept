import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { pushSubscription } from "@/src/lib/db/schema";
import { getEnv } from "@/src/config/env";
import { logger } from "@/src/lib/logger";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export function pushConfigured() {
  const env = getEnv();
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/**
 * Sends to every device of a user. Subscriptions the push service reports as
 * gone (404/410) are deleted. Returns "skipped" when the user has no devices.
 */
export async function sendPush(
  userId: string,
  payload: PushPayload,
): Promise<"sent" | "skipped"> {
  const env = getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return "skipped";
  const devices = await db()
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));
  if (!devices.length) return "skipped";
  let delivered = 0;
  let failed = 0;
  for (const device of devices) {
    try {
      await webpush.sendNotification(
        {
          endpoint: device.endpoint,
          keys: { p256dh: device.p256dh, auth: device.auth },
        },
        JSON.stringify(payload),
        {
          TTL: 6 * 3600,
          urgency: "normal",
          vapidDetails: {
            subject: env.VAPID_SUBJECT,
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
          },
        },
      );
      delivered += 1;
      await db()
        .update(pushSubscription)
        .set({ lastSuccessAt: new Date() })
        .where(eq(pushSubscription.id, device.id));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db()
          .delete(pushSubscription)
          .where(eq(pushSubscription.id, device.id));
      } else {
        failed += 1;
        logger.warn({ status }, "Push delivery failed");
      }
    }
  }
  if (!delivered && failed) throw new Error("PushFailed");
  return delivered ? "sent" : "skipped";
}
