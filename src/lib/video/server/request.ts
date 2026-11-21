// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { getSession } from "@/src/lib/auth/session";
import { withRequestLogging } from "@/src/lib/security/request";
import { sameOrigin } from "@/src/lib/security/validation";
import { VideoError } from "./errors";
import { videoEnv } from "./config";

type User = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

export function videoRequest(
  request: Request,
  route: string,
  handler: (user: User) => Promise<unknown>,
) {
  return withRequestLogging(async (incoming) => {
    try {
      const env = videoEnv();
      if (!sameOrigin(incoming, env.APP_URL))
        throw new VideoError("Invalid request origin", 403);
      const session = await getSession();
      if (!session) throw new VideoError("Authentication required", 401);
      if (!session.user.emailVerified)
        throw new VideoError("Email verification required", 403);
      return Response.json(await handler(session.user), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (error instanceof VideoError)
        return Response.json(
          { error: error.message },
          { status: error.status },
        );
      if (error instanceof SyntaxError)
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      throw error;
    }
  }, route)(request);
}
