import { z } from "zod";
import {
  apiError,
  idSchema,
  limitOrReject,
  readJson,
  requireApiUser,
} from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { explanationSchema } from "@/src/features/cards/schema";
import { runAnalysis } from "@/src/features/cards/analysis";
import { getPreferences } from "@/src/features/preferences/server";
import { AI_REQUESTS_PER_MINUTE } from "@/src/features/limits/rules";

type Ctx = { params: Promise<{ sessionId: string }> };

/** Analyzes the Feynman explanation and generates questions (one AI card). */
export async function POST(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).sessionId);
    if (!id.success) return apiError(404, "not_found");
    const limited = await limitOrReject(
      `ai:${user.id}`,
      AI_REQUESTS_PER_MINUTE,
      60,
    );
    if (limited) return limited;
    const body = await readJson(
      req,
      z.object({ explanation: explanationSchema }).strict(),
      32 * 1024,
    );
    if (body instanceof Response) return body;
    const prefs = await getPreferences(user.id);
    const outcome = await runAnalysis({
      userId: user.id,
      sessionId: id.data,
      explanation: body.explanation,
      locale: prefs.locale,
      timezone: prefs.timezone,
    });
    return outcome.ok
      ? Response.json(outcome.body)
      : apiError(outcome.status, outcome.error, outcome.extra);
  }, "learn-analyze")(request);
}
