import {
  apiError,
  limitOrReject,
  readJson,
  requireApiUser,
} from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { taskCreateSchema } from "@/src/features/tasks/schema";
import {
  createTask,
  listTasks,
  TaskRuleError,
} from "@/src/features/tasks/server";

export const GET = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const url = new URL(request.url);
  return Response.json(
    await listTasks(user.id, {
      includeDone: url.searchParams.get("done") === "1",
    }),
  );
}, "tasks");

export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const limited = await limitOrReject(`tasks:${user.id}`, 120, 60);
  if (limited) return limited;
  const input = await readJson(request, taskCreateSchema, 16 * 1024);
  if (input instanceof Response) return input;
  try {
    return Response.json(await createTask(user.id, input), { status: 201 });
  } catch (error) {
    if (error instanceof TaskRuleError) return apiError(409, error.code);
    throw error;
  }
}, "tasks");
