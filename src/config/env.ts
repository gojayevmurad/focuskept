// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { z } from "zod";
const optional = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().optional(),
);
const flag = (fallback: boolean) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? fallback : v === "true" || v === "1"),
    z.boolean(),
  );
const count = (fallback: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? fallback : Number(v)),
    z.number().int().min(0),
  );
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: optional,
    BETTER_AUTH_SECRET: optional,
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    POLAR_ACCESS_TOKEN: optional,
    POLAR_WEBHOOK_SECRET: optional,
    POLAR_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
    POLAR_MONTHLY_PRODUCT_ID: optional,
    POLAR_YEARLY_PRODUCT_ID: optional,
    POLAR_LIFETIME_PRODUCT_ID: optional,
    POLAR_PRO_BENEFIT_ID: optional,
    RESEND_API_KEY: optional,
    EMAIL_FROM: z.string().default("Starter <onboarding@resend.dev>"),
    EMAIL_MODE: z.enum(["preview", "send"]).default("preview"),
    LOG_LEVEL: z
      .enum(["debug", "info", "warn", "error", "silent"])
      .default("info"),
    SENTRY_DSN: optional,
    SENTRY_RELEASE: optional,
    // Product and self-hosting switches
    APP_NAME: z.string().min(1).default("FocusKept"),
    LOGO_URL: optional,
    SUPPORT_EMAIL: optional,
    // Search engines and AI search
    GOOGLE_SITE_VERIFICATION: optional,
    BING_SITE_VERIFICATION: optional,
    INDEXNOW_KEY: optional,
    // Public profiles used for structured data (comma separated URLs)
    SOCIAL_PROFILES: optional,
    // Operator details shown on the legal notice page
    LEGAL_ENTITY_NAME: optional,
    LEGAL_ADDRESS: optional,
    LEGAL_EMAIL: optional,
    LEGAL_REGISTRATION: optional,
    SECURITY_CONTACT: optional,
    BILLING_ENABLED: flag(false),
    ANALYTICS_ENABLED: flag(false),
    POSTHOG_KEY: z.preprocess(
      (v) =>
        typeof v === "string" && v.length > 0
          ? v
          : process.env.NEXT_PUBLIC_POSTHOG_KEY || undefined,
      optional,
    ),
    POSTHOG_HOST: z.preprocess(
      (v) =>
        typeof v === "string" && v.length > 0
          ? v
          : process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      z.string().default("https://us.i.posthog.com"),
    ),
    POSTHOG_ASSETS_HOST: z.preprocess(
      (v) =>
        typeof v === "string" && v.length > 0
          ? v
          : process.env.NEXT_PUBLIC_POSTHOG_ASSETS_HOST ||
            "https://us-assets.i.posthog.com",
      z.string().default("https://us-assets.i.posthog.com"),
    ),
    MARKETING_ENABLED: flag(true),
    SIGNUPS_MODE: z.enum(["open", "invite", "closed"]).default("open"),
    ADMIN_EMAILS: optional,
    FREE_WEEKLY_SESSIONS: count(3),
    HOST_PERK_SESSIONS: count(8),
    HOST_MIN_SESSIONS: count(10),
    // Video
    VIDEO_PROVIDER: z.enum(["cloudflare", "livekit", "none"]).default("none"),
    CLOUDFLARE_REALTIME_APP_ID: optional,
    CLOUDFLARE_REALTIME_APP_TOKEN: optional,
    CLOUDFLARE_TURN_KEY_ID: optional,
    CLOUDFLARE_TURN_KEY_TOKEN: optional,
    CLOUDFLARE_ACCOUNT_ID: optional,
    CLOUDFLARE_ANALYTICS_TOKEN: optional,
    VIDEO_USAGE_ALERT_GB: count(800),
    LIVEKIT_URL: optional,
    LIVEKIT_API_KEY: optional,
    LIVEKIT_API_SECRET: optional,
    // Web push
    VAPID_PUBLIC_KEY: optional,
    VAPID_PRIVATE_KEY: optional,
  })
  .superRefine((v, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    // `next build` runs with NODE_ENV=production but without runtime secrets.
    const building = process.env.NEXT_PHASE === "phase-production-build";
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(v.APP_URL).hostname,
    );
    if (v.NODE_ENV === "production" && !building) {
      if (!v.DATABASE_URL) issue("DATABASE_URL is required in production");
      if (
        !v.BETTER_AUTH_SECRET ||
        v.BETTER_AUTH_SECRET.length < 32 ||
        v.BETTER_AUTH_SECRET.includes("replace-with") ||
        v.BETTER_AUTH_SECRET.includes("development-only")
      )
        issue("Set a random BETTER_AUTH_SECRET of at least 32 characters");
      // A production build served on localhost (browser tests) is never public,
      // so it may use http, preview email and no video transport.
      if (!local) {
        if (!v.APP_URL.startsWith("https://"))
          issue("Production APP_URL must use HTTPS");
        if (v.EMAIL_MODE !== "send")
          issue("Production authentication requires EMAIL_MODE=send");
        if (v.VIDEO_PROVIDER === "none")
          issue("VIDEO_PROVIDER=none is for development only");
      }
    }
    if (
      v.VIDEO_PROVIDER === "cloudflare" &&
      (!v.CLOUDFLARE_REALTIME_APP_ID || !v.CLOUDFLARE_REALTIME_APP_TOKEN)
    )
      issue("Cloudflare video requires CLOUDFLARE_REALTIME_APP_ID and _TOKEN");
    if (
      v.VIDEO_PROVIDER === "livekit" &&
      (!v.LIVEKIT_URL || !v.LIVEKIT_API_KEY || !v.LIVEKIT_API_SECRET)
    )
      issue("LiveKit video requires LIVEKIT_URL, _API_KEY and _API_SECRET");
    if (Boolean(v.VAPID_PUBLIC_KEY) !== Boolean(v.VAPID_PRIVATE_KEY))
      issue("Configure both VAPID keys");
    if (v.BILLING_ENABLED && !v.POLAR_ACCESS_TOKEN)
      issue("BILLING_ENABLED=true requires Polar credentials");
    if (v.EMAIL_MODE === "send" && !v.RESEND_API_KEY)
      issue("RESEND_API_KEY is required to send email");
    if (Boolean(v.GOOGLE_CLIENT_ID) !== Boolean(v.GOOGLE_CLIENT_SECRET))
      issue("Configure both Google credentials");
    if (
      v.POLAR_ACCESS_TOKEN &&
      (!v.POLAR_WEBHOOK_SECRET || !v.POLAR_PRO_BENEFIT_ID)
    )
      issue("Polar requires webhook secret and Pro benefit ID");
  });
export type Env = z.infer<typeof envSchema>;
// Older deployments name the PostHog settings NEXT_PUBLIC_*. Next inlines
// `process.env.NEXT_PUBLIC_*` at build time, so read them from a copy here.
const legacyNames = {
  POSTHOG_KEY: "NEXT_PUBLIC_POSTHOG_KEY",
  POSTHOG_HOST: "NEXT_PUBLIC_POSTHOG_HOST",
  POSTHOG_ASSETS_HOST: "NEXT_PUBLIC_POSTHOG_ASSETS_HOST",
} as const;
export function getEnv(): Env {
  const source: Record<string, string | undefined> = { ...process.env };
  for (const [name, legacy] of Object.entries(legacyNames))
    if (!source[name]) source[name] = source[legacy];
  return envSchema.parse(source);
}
