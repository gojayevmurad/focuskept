// SPDX-License-Identifier: AGPL-3.0-only
import { getSession } from "@/src/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { profile } from "@/src/lib/db/schema";
import { adminEmails } from "@/src/config/app";
import { getEnv } from "@/src/config/env";
import { sameOrigin } from "@/src/lib/security/validation";
import { withRequestLogging } from "@/src/lib/security/request";
import {
  InstantMatchFailure,
  joinInstantMatch,
} from "@/src/lib/matching/instant";

export const POST = (
  request: Request,
  ctx: { params: Promise<{ requestId: string }> },
) =>
  withRequestLogging(async (req) => {
    if (!sameOrigin(req, getEnv().APP_URL))
      return new Response(null, { status: 403 });
    const session = await getSession();
    if (!session?.user.emailVerified)
      return new Response(null, { status: 404 });
    const [prof] = await db()
      .select()
      .from(profile)
      .where(eq(profile.userId, session.user.id));
    if (
      !prof ||
      prof.suspendedAt ||
      !(
        prof.role === "admin" ||
        adminEmails().includes(session.user.email.toLowerCase())
      )
    )
      return new Response(null, { status: 404 });
    const { requestId } = await ctx.params;
    try {
      return Response.json({
        request: await joinInstantMatch(session.user.id, requestId),
      });
    } catch (error) {
      if (error instanceof InstantMatchFailure)
        return Response.json({ error: error.code }, { status: 409 });
      throw error;
    }
  }, "match-now/join")(request);
