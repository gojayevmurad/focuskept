import { apiError, readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { preferencesPatchSchema } from "@/src/features/preferences/schema";
import {
  getPreferences,
  updatePreferences,
} from "@/src/features/preferences/server";

export const GET = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  return Response.json(await getPreferences(user.id));
}, "preferences");

export const PATCH = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const patch = await readJson(request, preferencesPatchSchema, 16 * 1024);
  if (patch instanceof Response) return patch;
  if (Object.keys(patch).length === 0) return apiError(400, "empty_patch");
  return Response.json(await updatePreferences(user.id, patch));
}, "preferences");
