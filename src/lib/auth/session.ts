import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { auth } from ".";
export async function getSession() {
  const requestHeaders = await headers();
  if (!process.env.DATABASE_URL) return null;
  return auth().api.getSession({ headers: requestHeaders });
}
/** For pages. `next` is a locale-less app path to return to after sign-in. */
export async function requireSession(next?: string) {
  const session = await getSession();
  if (!session || !session.user.emailVerified) {
    const locale = await getLocale();
    redirect(
      `/${locale}/sign-in` + (next ? `?next=${encodeURIComponent(next)}` : ""),
    );
  }
  return session;
}
/** For route handlers: a verified session or null (caller answers 401). */
export async function getVerifiedSession() {
  const session = await getSession();
  return session?.user.emailVerified ? session : null;
}
/** The current app path without its locale prefix (set by proxy.ts). */
export async function currentAppPath() {
  const value = (await headers()).get("x-fk-path") ?? "";
  return value.replace(/^\/[A-Za-z-]+(?=\/|$)/, "") || "/";
}
