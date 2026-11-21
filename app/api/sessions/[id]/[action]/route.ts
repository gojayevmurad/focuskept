import { z } from "zod";
import { getSession } from "@/src/lib/auth/session";
import { getEnv } from "@/src/config/env";
import { sameOrigin } from "@/src/lib/security/validation";
import { withRequestLogging } from "@/src/lib/security/request";
import { rateLimit } from "@/src/lib/security/rate-limit";
import {
  GOAL_MAX,
  OUTCOMES,
  joinRoom,
  leaveRoom,
  roomState,
  saveQuality,
  setGoal,
  setOutcome,
} from "@/src/lib/sessions/lifecycle";
import { authorizeRoom } from "@/src/lib/sessions/access";
import { trackForUser } from "@/src/lib/analytics/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; action: string }> };

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export const GET = (request: Request, ctx: Ctx) =>
  withRequestLogging(async () => {
    const session = await getSession();
    if (!session?.user.emailVerified) return new Response(null, { status: 401 });
    const { id, action } = await ctx.params;
    if (action !== "state") return notFound();
    const state = await roomState(id, session.user.id);
    return state ? Response.json(state, { headers: { "Cache-Control": "no-store" } }) : notFound();
  }, "session-state")(request);

const quality = z.record(z.string().max(40), z.union([z.number().finite(), z.boolean()])).refine(
  (v) => Object.keys(v).length <= 20,
);

export const POST = (request: Request, ctx: Ctx) =>
  withRequestLogging(async (req) => {
    if (!sameOrigin(req, getEnv().APP_URL)) return new Response(null, { status: 403 });
    const session = await getSession();
    if (!session?.user.emailVerified) return new Response(null, { status: 401 });
    const userId = session.user.id;
    const { id, action } = await ctx.params;
    if (!(await rateLimit(`room:${userId}`, 120, 60))) return new Response(null, { status: 429 });
    const body = req.headers.get("content-length") === "0" ? {} : await req.json().catch(() => ({}));
    switch (action) {
      case "join":
        return (await joinRoom(id, userId)) ? Response.json({ ok: true }) : notFound();
      case "leave":
        return (await leaveRoom(id, userId)) ? Response.json({ ok: true }) : notFound();
      case "goal": {
        const parsed = z.object({ text: z.string().max(GOAL_MAX * 2) }).safeParse(body);
        if (!parsed.success) return new Response(null, { status: 400 });
        const goal = await setGoal(id, userId, parsed.data.text);
        return goal === null ? notFound() : Response.json({ goal });
      }
      case "outcome": {
        const parsed = z.object({ outcome: z.enum(OUTCOMES) }).safeParse(body);
        if (!parsed.success) return new Response(null, { status: 400 });
        const outcome = await setOutcome(id, userId, parsed.data.outcome);
        return outcome === null ? notFound() : Response.json({ outcome });
      }
      case "quality": {
        const parsed = quality.safeParse(body);
        if (!parsed.success) return new Response(null, { status: 400 });
        if (!(await authorizeRoom(id, userId))) return notFound();
        await saveQuality(id, userId, parsed.data);
        void trackForUser(userId, "session_quality", parsed.data);
        return Response.json({ ok: true });
      }
      default:
        return notFound();
    }
  }, "session-action")(request);
