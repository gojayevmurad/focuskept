// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { PostHog } from "posthog-node";
import { getEnv } from "@/src/config/env";
import type { AnalyticsEvent, EventProperties } from "./events";

export async function trackServer(
  userId: string,
  event: AnalyticsEvent,
  properties: EventProperties,
  consent: boolean,
  uuid?: string,
) {
  const env = getEnv();
  const key = env.POSTHOG_KEY;
  if (!key || !consent || !env.ANALYTICS_ENABLED) return;
  const client = new PostHog(key, {
    host: env.POSTHOG_HOST || "https://us.i.posthog.com",
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
