// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { getSession } from "@/src/lib/auth/session";
import { getEnv } from "@/src/config/env";
import { sameOrigin } from "@/src/lib/security/validation";
import { rateLimit } from "@/src/lib/security/rate-limit";
import { withRequestLogging } from "@/src/lib/security/request";
import { cancelInstantMatch, getInstantMatch, InstantMatchFailure, startInstantMatch } from "@/src/lib/matching/instant";

export const runtime = "nodejs";
const schema = z.object({ durationMin: z.union([z.literal(25), z.literal(50)]) });
async function handle(req: Request) {
  if (req.method !== "GET" && !sameOrigin(req, getEnv().APP_URL)) return Response.json({ error: "forbidden" }, { status: 403 });
  const session = await getSession();
  if (!session?.user.emailVerified) return Response.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  try {
    let request;
    if (req.method === "GET") request = await getInstantMatch(userId);
    else if (req.method === "DELETE") request = await cancelInstantMatch(userId);
    else {
      if (!(await rateLimit(`match-now:${userId}`, 10, 600))) return Response.json({ error: "rate_limited" }, { status: 429 });
      const parsed = schema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return Response.json({ error: "duration" }, { status: 400 });
      request = await startInstantMatch(userId, parsed.data.durationMin);
    }
    return Response.json({ request }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InstantMatchFailure) return Response.json({ error: error.code }, { status: error.code === "suspended" ? 403 : 409 });
    throw error;
  }
}
export const GET = withRequestLogging(handle, "match-now");
export const POST = withRequestLogging(handle, "match-now");
export const DELETE = withRequestLogging(handle, "match-now");
