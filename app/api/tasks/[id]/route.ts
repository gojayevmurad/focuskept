import { apiError, idSchema, readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { taskUpdateSchema } from "@/src/features/tasks/schema";
import {
  deleteTask,
  TaskRuleError,
  updateTask,
} from "@/src/features/tasks/server";
import { recordTaskCompleted } from "@/src/features/analytics/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError(404, "not_found");
    const patch = await readJson(req, taskUpdateSchema, 16 * 1024);
    if (patch instanceof Response) return patch;
    try {
      const row = await updateTask(user.id, id.data, patch);
      if (!row) return apiError(404, "not_found");
      if (patch.status === "done") await recordTaskCompleted(user.id);
      return Response.json(row);
    } catch (error) {
      if (error instanceof TaskRuleError) return apiError(409, error.code);
      throw error;
    }
  }, "task")(request);
}

export async function DELETE(request: Request, ctx: Ctx) {
  return withRequestLogging(async (req) => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;
    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success || !(await deleteTask(user.id, id.data)))
      return apiError(404, "not_found");
    return new Response(null, { status: 204 });
  }, "task")(request);
}
