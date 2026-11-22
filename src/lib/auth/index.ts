// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getEnv } from "@/src/config/env";
import { db } from "@/src/lib/db";
import * as schema from "@/src/lib/db/schema";
import { sendAuthEmail } from "@/src/lib/email/send";
import { eq } from "drizzle-orm";
import { getProfileByReferralCode, REFERRAL_COOKIE } from "@/src/lib/profiles";
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
      // SIGNUPS_MODE: "closed" blocks new accounts, "invite" needs a valid invite cookie.
      validateUserInfo: async ({ source }, context) => {
        if (source.action !== "create-user") return;
        const mode = getEnv().SIGNUPS_MODE;
        if (mode === "open") return;
        if (mode === "closed")
          return {
            error: "signups_closed",
            errorDescription: "New accounts are not open right now.",
          };
        const code = context.getCookie?.(REFERRAL_COOKIE);
        if (!code || !(await getProfileByReferralCode(code)))
          return {
            error: "invite_required",
            errorDescription: "You need an invite link to create an account.",
          };
      },
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          // Cancel a running subscription first so nobody keeps paying for a deleted account.
          const now = new Date();
          const subs = await db()
            .select()
            .from(schema.subscription)
            .where(eq(schema.subscription.userId, user.id));
          if (
            subs.some(
              (s) =>
                s.status === "active" &&
                s.periodEnd > now &&
                !s.cancelAtPeriodEnd,
            )
          )
            throw new APIError("FORBIDDEN", {
              message:
                "Cancel your Plus subscription in Billing first, then delete your account.",
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
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
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
