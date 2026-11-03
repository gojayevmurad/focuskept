import { z } from "zod";
import { apiError, idSchema, readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { projectSchema } from "@/src/features/tasks/schema";
import { deleteProject, updateProject } from "@/src/features/tasks/server";

type Ctx = { params: Promise<{ id: string }> };
const patchSchema = projectSchema
  .partial()
  .extend({ archived: z.boolean().optional() })
  .strict();

export async function PATCH(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError(404, "not_found");
    const patch = await readJson(req, patchSchema, 2048);
    if (patch instanceof Response) return patch;
    const row = await updateProject(user.id, id.data, patch);
    return row ? Response.json(row) : apiError(404, "not_found");
  }, "project")(request);
}

export async function DELETE(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success || !(await deleteProject(user.id, id.data)))
      return apiError(404, "not_found");
    return new Response(null, { status: 204 });
  }, "project")(request);
}
