// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import {
  requestSchemas,
  type CloudflareAction,
} from "@/src/lib/video/protocol";
import { cloudflareProxy } from "@/src/lib/video/server/cloudflare-proxy";
import { VideoError } from "@/src/lib/video/server/errors";
import { videoRequest } from "@/src/lib/video/server/request";
import { rateLimit } from "@/src/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; action: string }> },
) {
  return videoRequest(
    request,
    "/api/video/cloudflare/[sessionId]/[action]",
    async (user) => {
      if (!(await rateLimit(`video:cf:${user.id}`, 120, 60))) {
        throw new VideoError("Too many video requests", 429);
      }
      const { sessionId, action } = await context.params;
      if (!Object.hasOwn(requestSchemas, action))
        throw new VideoError("Video action not found", 404);
      return cloudflareProxy(
        sessionId,
        user.id,
        action as CloudflareAction,
        await request.json(),
      );
    },
  );
}
