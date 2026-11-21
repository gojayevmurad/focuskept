import "server-only";
import { cache } from "react";
import { getLocale } from "next-intl/server";
import { requireSession } from "@/src/lib/auth/session";
import { ensureProfile } from "@/src/lib/profiles";
import { adminEmails } from "@/src/config/app";
import { redirect } from "@/src/i18n/navigation";

/**
 * Signed-in, verified user with a profile. Sends people who have not finished
 * onboarding there first, and suspended accounts to the suspended page.
 */
export const requireAppUser = cache(async function requireAppUser(
  allowUnonboarded = false,
) {
  const session = await requireSession();
  const prof = await ensureProfile(session.user);
  const locale = await getLocale();
  if (prof.suspendedAt) redirect({ href: "/suspended", locale });
  if (!prof.onboardedAt && !allowUnonboarded)
    redirect({ href: "/onboarding", locale });
  const isAdmin =
    prof.role === "admin" ||
    adminEmails().includes(session.user.email.toLowerCase());
  return { user: session.user, profile: prof, isAdmin };
});

export async function requireAdmin() {
  const current = await requireAppUser();
  if (!current.isAdmin)
    redirect({ href: "/dashboard", locale: await getLocale() });
  return current;
}
