import { apiError, idSchema, readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { cardUpdateSchema } from "@/src/features/cards/schema";
import { deleteCard, getCard, updateCard } from "@/src/features/cards/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).id);
    const card = id.success ? await getCard(user.id, id.data) : undefined;
    return card ? Response.json(card) : apiError(404, "not_found");
  }, "card")(request);
}

export async function PATCH(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError(404, "not_found");
    const patch = await readJson(req, cardUpdateSchema, 128 * 1024);
    if (patch instanceof Response) return patch;
    const row = await updateCard(user.id, id.data, patch);
    return row ? Response.json(row) : apiError(404, "not_found");
  }, "card")(request);
}

export async function DELETE(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success || !(await deleteCard(user.id, id.data)))
      return apiError(404, "not_found");
    return new Response(null, { status: 204 });
  }, "card")(request);
}
