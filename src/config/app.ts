// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { brand } from "./brand";
import { getEnv } from "./env";

export type AppConfig = ReturnType<typeof getAppConfig>;

export function getAppConfig() {
  const env = getEnv();
  return {
    name: env.APP_NAME || brand.name,
    description: brand.description,
    url: env.APP_URL,
    logoUrl: env.LOGO_URL,
    supportEmail: env.SUPPORT_EMAIL || brand.supportEmail,
    billingEnabled: env.BILLING_ENABLED,
    analyticsEnabled: env.ANALYTICS_ENABLED,
    posthogKey: env.POSTHOG_KEY,
    posthogHost: env.POSTHOG_HOST,
    posthogAssetsHost: env.POSTHOG_ASSETS_HOST,
    analytics: {
      enabled: env.ANALYTICS_ENABLED && Boolean(env.POSTHOG_KEY),
      key: env.POSTHOG_KEY,
      host: env.POSTHOG_HOST,
      assetsHost: env.POSTHOG_ASSETS_HOST,
      apiHost: "/ingest",
      // The PostHog app lives next to its ingestion host (us.i.posthog.com -> us.posthog.com).
      uiHost: env.POSTHOG_HOST.replace("://us.i.", "://us.").replace(
        "://eu.i.",
        "://eu.",
      ),
    },
    marketingEnabled: env.MARKETING_ENABLED,
    signupsMode: env.SIGNUPS_MODE,
    videoProvider: env.VIDEO_PROVIDER,
    freeWeeklySessions: env.FREE_WEEKLY_SESSIONS,
    googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    pushPublicKey: env.VAPID_PUBLIC_KEY,
  };
}

export function adminEmails() {
  return (getEnv().ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
