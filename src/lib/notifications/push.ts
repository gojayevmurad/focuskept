import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { pushSubscription } from "@/src/lib/db/schema";
import { getAppConfig } from "@/src/config/app";
import { getEnv } from "@/src/config/env";
import { logger } from "@/src/lib/logger";

export function pushConfigured() {
  const env = getEnv();
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export async function sendPush(
  userId: string,
  message: { title: string; body: string; url: string; tag?: string },
) {
  if (!pushConfigured()) return 0;
  const env = getEnv();
  const app = getAppConfig();
  webpush.setVapidDetails(
    `mailto:${app.supportEmail}`,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
  const subs = await db()
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(message),
        { TTL: 600, urgency: "high" },
      );
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410)
        await db()
          .delete(pushSubscription)
          .where(eq(pushSubscription.id, sub.id));
      else logger.warn({ status }, "Push delivery failed");
    }
  }
  return sent;
}
