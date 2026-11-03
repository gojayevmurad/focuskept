import { eq } from "drizzle-orm";
import { authSecret, getEnv } from "@/src/config/env";
import { db } from "@/src/lib/db";
import { userPreferences } from "@/src/lib/db/schema";
import { withRequestLogging } from "@/src/lib/security/request";
import { verifyUnsubscribe } from "@/src/features/notifications/tokens";
import { defaultLocale, isLocale } from "@/src/i18n/config";

const secret = authSecret;

/** RFC 8058 one-click unsubscribe: mail clients POST here; the signed token is the authorization. */
export const POST = withRequestLogging(async (request) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const claim = verifyUnsubscribe(secret(), token);
  if (!claim) return Response.json({ error: "invalid_token" }, { status: 400 });
  await db()
    .update(userPreferences)
    .set(
      claim.category === "reviews"
        ? { emailReviews: false, updatedAt: new Date() }
        : { emailWeekly: false, updatedAt: new Date() },
    )
    .where(eq(userPreferences.userId, claim.userId));
  return Response.json({ ok: true, category: claim.category });
}, "unsubscribe");

/** Opening the link in a browser shows a confirmation page in the user's language. */
export const GET = withRequestLogging(async (request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const claim = verifyUnsubscribe(secret(), token);
  let locale = defaultLocale as string;
  if (claim) {
    const [prefs] = await db()
      .select({ locale: userPreferences.locale })
      .from(userPreferences)
      .where(eq(userPreferences.userId, claim.userId));
    if (prefs && isLocale(prefs.locale)) locale = prefs.locale;
  }
  return Response.redirect(
    new URL(
      `/${locale}/unsubscribe?token=${encodeURIComponent(token)}`,
      getEnv().APP_URL,
    ),
    303,
  );
}, "unsubscribe");
