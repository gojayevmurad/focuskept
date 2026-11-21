// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { getProfileByReferralCode, REFERRAL_COOKIE } from "@/src/lib/profiles";
import { safeRedirect } from "@/src/lib/security/validation";

/** Invite link: remembers who invited this visitor for 30 days, then sends them on. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const target = new URL(next ? safeRedirect(next) : "/sign-up", url);
  const response = NextResponse.redirect(target, 302);
  if (/^[a-z0-9]{4,16}$/.test(code) && (await getProfileByReferralCode(code)))
    response.cookies.set(REFERRAL_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: 30 * 86_400,
      path: "/",
    });
  return response;
}
