import { readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { preferencesInitSchema } from "@/src/features/preferences/schema";
import { initPreferences } from "@/src/features/preferences/server";

/** Called once on the first app visit with the browser's timezone. */
export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const body = await readJson(request, preferencesInitSchema, 1024);
  if (body instanceof Response) return body;
  return Response.json(await initPreferences(user.id, body));
}, "preferences-init");
