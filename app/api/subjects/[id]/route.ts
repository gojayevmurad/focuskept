import { apiError, idSchema, readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { subjectPatchSchema } from "@/src/features/subjects/schema";
import {
  deleteSubject,
  SubjectNameTaken,
  updateSubject,
} from "@/src/features/subjects/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError(404, "not_found");
    const patch = await readJson(req, subjectPatchSchema, 2048);
    if (patch instanceof Response) return patch;
    try {
      const row = await updateSubject(user.id, id.data, patch);
      return row ? Response.json(row) : apiError(404, "not_found");
    } catch (error) {
      if (error instanceof SubjectNameTaken) return apiError(409, "name_taken");
      throw error;
    }
  }, "subject")(request);
}

export async function DELETE(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success || !(await deleteSubject(user.id, id.data)))
      return apiError(404, "not_found");
    return new Response(null, { status: 204 });
  }, "subject")(request);
}
