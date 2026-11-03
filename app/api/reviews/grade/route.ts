import {
  apiError,
  limitOrReject,
  readJson,
  requireApiUser,
} from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { gradeRequestSchema } from "@/src/features/reviews/schema";
import { gradeAnswer } from "@/src/features/reviews/server";
import { getPreferences } from "@/src/features/preferences/server";
import { AI_REQUESTS_PER_MINUTE } from "@/src/features/limits/rules";

export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const limited = await limitOrReject(
    `ai:${user.id}`,
    AI_REQUESTS_PER_MINUTE,
    60,
  );
  if (limited) return limited;
  const input = await readJson(request, gradeRequestSchema, 8 * 1024);
  if (input instanceof Response) return input;
  const prefs = await getPreferences(user.id);
  const outcome = await gradeAnswer(
    user.id,
    input,
    prefs.locale,
    prefs.timezone,
  );
  return outcome.ok
    ? Response.json(outcome)
    : apiError(outcome.status, outcome.error);
}, "reviews-grade");
