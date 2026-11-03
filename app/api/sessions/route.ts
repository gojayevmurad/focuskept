import { limitOrReject, readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { sessionCreateSchema } from "@/src/features/sessions/schema";
import { createSession, todaySummary } from "@/src/features/sessions/server";
import { getPreferences } from "@/src/features/preferences/server";

/** Saves a finished focus session (idempotent by clientId) and returns today's summary. */
export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const limited = await limitOrReject(`sessions:${user.id}`, 60, 60);
  if (limited) return limited;
  const input = await readJson(request, sessionCreateSchema, 128 * 1024);
  if (input instanceof Response) return input;
  const { session, created } = await createSession(user.id, input);
  const prefs = await getPreferences(user.id);
  return Response.json(
    {
      id: session.id,
      mode: session.mode,
      created,
      summary: await todaySummary(user.id, prefs.timezone),
    },
    { status: created ? 201 : 200 },
  );
}, "sessions");
