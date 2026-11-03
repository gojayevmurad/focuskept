import { readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { projectSchema } from "@/src/features/tasks/schema";
import { createProject, listProjects } from "@/src/features/tasks/server";

export const GET = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  return Response.json(await listProjects(user.id));
}, "projects");

export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const input = await readJson(request, projectSchema, 2048);
  if (input instanceof Response) return input;
  return Response.json(await createProject(user.id, input), { status: 201 });
}, "projects");
