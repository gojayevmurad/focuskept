import "server-only";
import { PostHog } from "posthog-node";
import type { AnalyticsEvent, EventProperties } from "./events";
export async function trackServer(
  userId: string,
  event: AnalyticsEvent,
  properties: EventProperties,
  consent: boolean,
  uuid?: string,
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || !consent) return;
  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  await client.captureImmediate({
    distinctId: userId,
    event,
    properties,
    uuid,
  });
  await client.shutdown();
}
