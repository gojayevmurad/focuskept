import { apiError, idSchema, readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { draftPatchSchema } from "@/src/features/cards/schema";
import { saveDraftExplanation } from "@/src/features/cards/server";

type Ctx = { params: Promise<{ sessionId: string }> };

/** Autosaves the Feynman explanation while the user writes. */
export async function PATCH(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).sessionId);
    if (!id.success) return apiError(404, "not_found");
    const body = await readJson(req, draftPatchSchema, 32 * 1024);
    if (body instanceof Response) return body;
    return (await saveDraftExplanation(user.id, id.data, body.explanation))
      ? new Response(null, { status: 204 })
      : apiError(404, "not_found");
  }, "learn-draft")(request);
}
