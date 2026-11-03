import "server-only";
import { z } from "zod";
const optional = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().optional(),
);
const blank = (v: unknown) => (v === "" ? undefined : v);
const toNumber = (v: unknown) =>
  v === "" || v === undefined || v === null ? undefined : Number(v);
const int = (min: number, max = Number.MAX_SAFE_INTEGER) =>
  z.number().int().min(min).max(max);
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
    EMAIL_FROM: z.string().default("FocusKept <onboarding@resend.dev>"),
    EMAIL_MODE: z.enum(["preview", "send"]).default("preview"),
    LOG_LEVEL: z
      .enum(["debug", "info", "warn", "error", "silent"])
      .default("info"),
    SENTRY_DSN: optional,
    SENTRY_RELEASE: optional,
    // Reminder/report emails; auth emails keep EMAIL_FROM.
    REMINDER_EMAIL_FROM: z.preprocess(
      blank,
      z.string().default("FocusKept <reminders@focuskept.com>"),
    ),
    // AI (OpenAI). Disabled until a key is configured; the UI falls back to manual questions.
    OPENAI_API_KEY: optional,
    // Optional OpenAI-compatible endpoint (used by the E2E mock server).
    AI_BASE_URL: optional,
    AI_MODEL: z.preprocess(blank, z.string().default("gpt-4.1-mini")),
    AI_TIMEOUT_MS: z.preprocess(toNumber, int(1000, 120000).default(30000)),
    PRO_MONTHLY_AI_CARDS: z.preprocess(toNumber, int(1).default(300)),
    // Global daily token budget (input + output). Unset = no global cap.
    AI_DAILY_TOKEN_BUDGET: z.preprocess(toNumber, int(1).optional()),
    // Background jobs. Cron endpoints answer 503 until a secret is configured.
    CRON_SECRET: optional,
    // Web push. Disabled until all three values are configured.
    VAPID_PUBLIC_KEY: optional,
    VAPID_PRIVATE_KEY: optional,
    VAPID_SUBJECT: z.preprocess(
      blank,
      z.string().default("mailto:hello@focuskept.com"),
    ),
  })
  .superRefine((v, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (v.NODE_ENV === "production") {
      if (!v.DATABASE_URL) issue("DATABASE_URL is required in production");
      if (
        !v.BETTER_AUTH_SECRET ||
        v.BETTER_AUTH_SECRET.length < 32 ||
        v.BETTER_AUTH_SECRET.includes("replace-with") ||
        v.BETTER_AUTH_SECRET.includes("development-only")
      )
        issue("Set a random BETTER_AUTH_SECRET of at least 32 characters");
      if (!v.APP_URL.startsWith("https://"))
        issue("Production APP_URL must use HTTPS");
      if (v.EMAIL_MODE !== "send")
        issue("Production authentication requires EMAIL_MODE=send");
    }
    if (v.EMAIL_MODE === "send" && !v.RESEND_API_KEY)
      issue("RESEND_API_KEY is required to send email");
    if (Boolean(v.GOOGLE_CLIENT_ID) !== Boolean(v.GOOGLE_CLIENT_SECRET))
      issue("Configure both Google credentials");
    if (v.CRON_SECRET && v.CRON_SECRET.length < 32)
      issue("CRON_SECRET must be at least 32 random characters");
    if (Boolean(v.VAPID_PUBLIC_KEY) !== Boolean(v.VAPID_PRIVATE_KEY))
      issue("Configure both VAPID keys");
    if (
      v.VAPID_PUBLIC_KEY &&
      !v.VAPID_SUBJECT.startsWith("mailto:") &&
      !v.VAPID_SUBJECT.startsWith("https://")
    )
      issue("VAPID_SUBJECT must be a mailto: or https: URL");
    if (
      v.POLAR_ACCESS_TOKEN &&
      (!v.POLAR_WEBHOOK_SECRET || !v.POLAR_PRO_BENEFIT_ID)
    )
      issue("Polar requires webhook secret and Pro benefit ID");
  });
export function getEnv() {
  return envSchema.parse(process.env);
}

/**
 * Signing secret for auth and unsubscribe tokens. The fallback exists only for
 * local development: production startup rejects a missing or weak secret.
 */
export function authSecret() {
  return (
    getEnv().BETTER_AUTH_SECRET ||
    "development-only-secret-change-before-deploying-12345"
  );
}
