import {
  apiError,
  limitOrReject,
  readJson,
  requireApiUser,
} from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { reviewSubmitSchema } from "@/src/features/reviews/schema";
import { ReviewError, submitReview } from "@/src/features/reviews/server";
import { getPreferences, today } from "@/src/features/preferences/server";

export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const limited = await limitOrReject(`reviews:${user.id}`, 60, 60);
  if (limited) return limited;
  const input = await readJson(request, reviewSubmitSchema, 64 * 1024);
  if (input instanceof Response) return input;
  const prefs = await getPreferences(user.id);
  try {
    return Response.json(
      await submitReview(user.id, input, prefs, today(prefs)),
    );
  } catch (error) {
    if (error instanceof ReviewError)
      return apiError(error.code === "not_found" ? 404 : 400, error.code);
    throw error;
  }
}, "reviews");
