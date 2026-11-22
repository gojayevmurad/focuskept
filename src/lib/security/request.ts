// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { logger } from "@/src/lib/logger";
import { captureException } from "@sentry/nextjs";

function isNextRedirect(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT"),
  );
}

export function withRequestLogging(
  handler: (request: Request) => Promise<Response>,
  route: string,
) {
  return async (request: Request) => {
    const requestId = crypto.randomUUID();
    const start = Date.now();
    try {
      const response = await handler(request);
      response.headers.set("X-Request-ID", requestId);
      logger.info(
        {
          requestId,
          route,
          method: request.method,
          status: response.status,
          durationMs: Date.now() - start,
        },
        "Request completed",
      );
      return response;
    } catch (error) {
      if (isNextRedirect(error)) {
        throw error;
      }
      logger.error({ requestId, route }, "Request failed");
      captureException(error, { tags: { requestId, route } });
      return Response.json(
        { error: "Unable to complete request", requestId },
        { status: 500, headers: { "X-Request-ID": requestId } },
      );
    }
  };
}
