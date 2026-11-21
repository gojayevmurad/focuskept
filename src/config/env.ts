import "server-only";
import { z } from "zod";
const optional = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().optional(),
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
    if (
      v.POLAR_ACCESS_TOKEN &&
      (!v.POLAR_WEBHOOK_SECRET || !v.POLAR_PRO_BENEFIT_ID)
    )
      issue("Polar requires webhook secret and Pro benefit ID");
  });
export function getEnv() {
  return envSchema.parse(process.env);
}
