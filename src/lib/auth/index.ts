import "server-only";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getEnv } from "@/src/config/env";
import { db } from "@/src/lib/db";
import * as schema from "@/src/lib/db/schema";
import { sendAuthEmail } from "@/src/lib/email/send";
import { eq } from "drizzle-orm";
function createAuth() {
  const env = getEnv();
  return betterAuth({
    baseURL: env.APP_URL,
    secret:
      env.BETTER_AUTH_SECRET ||
      "development-only-secret-change-before-deploying-12345",
    database: drizzleAdapter(db(), { provider: "pg", schema }),
    trustedOrigins: [env.APP_URL],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      sendResetPassword: async ({ user, url }) =>
        sendAuthEmail(user.email, url, "reset"),
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        sendAuthEmail(user.email, url, "verification"),
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          const [customer] = await db()
            .select()
            .from(schema.billingCustomer)
            .where(eq(schema.billingCustomer.userId, user.id));
          if (customer)
            throw new APIError("FORBIDDEN", {
              message:
                "Contact support to settle billing and delete your account.",
            });
        },
      },
    },
    session: { expiresIn: 604800, updateAge: 86400, freshAge: 300 },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: env.APP_URL.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function auth() {
  return (instance ??= createAuth());
}
