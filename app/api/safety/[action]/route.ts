// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { getSession } from "@/src/lib/auth/session";
import { getEnv } from "@/src/config/env";
import { sameOrigin } from "@/src/lib/security/validation";
import { withRequestLogging } from "@/src/lib/security/request";
import { rateLimit } from "@/src/lib/security/rate-limit";
import {
  blockUser,
  REPORT_REASONS,
  reportUser,
  unblockUser,
} from "@/src/lib/safety";

export const runtime = "nodejs";

const schemas = {
  report: z.object({
    targetId: z.string().min(1).max(100),
    sessionId: z.string().uuid().optional(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().max(2000).default(""),
  }),
  block: z.object({
    targetId: z.string().min(1).max(100),
    sessionId: z.string().uuid().optional(),
  }),
  unblock: z.object({ targetId: z.string().min(1).max(100) }),
};

export const POST = (
  request: Request,
  ctx: { params: Promise<{ action: string }> },
) =>
  withRequestLogging(async (req) => {
    if (!sameOrigin(req, getEnv().APP_URL))
      return new Response(null, { status: 403 });
    const session = await getSession();
    if (!session?.user.emailVerified)
      return new Response(null, { status: 401 });
    const userId = session.user.id;
    const { action } = await ctx.params;
    if (!(await rateLimit(`safety:${userId}`, 20, 3600)))
      return new Response(null, { status: 429 });
    const body = await req.json().catch(() => null);
    if (action === "report") {
      const parsed = schemas.report.safeParse(body);
      if (!parsed.success) return new Response(null, { status: 400 });
      const id = await reportUser({ reporterId: userId, ...parsed.data });
      return id
        ? Response.json({ ok: true })
        : new Response(null, { status: 404 });
    }
    if (action === "block") {
      const parsed = schemas.block.safeParse(body);
      if (!parsed.success) return new Response(null, { status: 400 });
      await blockUser(userId, parsed.data.targetId, parsed.data.sessionId);
      return Response.json({ ok: true });
    }
    if (action === "unblock") {
      const parsed = schemas.unblock.safeParse(body);
      if (!parsed.success) return new Response(null, { status: 400 });
      await unblockUser(userId, parsed.data.targetId);
      return Response.json({ ok: true });
    }
    return new Response(null, { status: 404 });
  }, "safety")(request);
