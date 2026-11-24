// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { getProfileByReferralCode, REFERRAL_COOKIE } from "@/src/lib/profiles";
import { safeRedirect } from "@/src/lib/security/validation";
import { getAppConfig } from "@/src/config/app";

/** Invite link: remembers who invited this visitor for 30 days, then sends them on. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  // Behind a proxy request.url carries the internal host, so redirect on the public origin.
  const origin = new URL(getAppConfig().url);
  const target = new URL(next ? safeRedirect(next) : "/sign-up", origin);
  const response = NextResponse.redirect(target, 302);
  if (/^[a-z0-9]{4,16}$/.test(code) && (await getProfileByReferralCode(code)))
    response.cookies.set(REFERRAL_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.protocol === "https:",
      maxAge: 30 * 86_400,
      path: "/",
    });
  return response;
}
