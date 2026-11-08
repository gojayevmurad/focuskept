import { readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { subjectSchema } from "@/src/features/subjects/schema";
import { createSubject, listSubjects } from "@/src/features/subjects/server";

export const GET = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  return Response.json(await listSubjects(user.id));
}, "subjects");

export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const input = await readJson(request, subjectSchema, 2048);
  if (input instanceof Response) return input;
  return Response.json(await createSubject(user.id, input), { status: 201 });
}, "subjects");
