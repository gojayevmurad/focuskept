import "server-only";
import { logger } from "@/src/lib/logger";
import { captureException } from "@sentry/nextjs";
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
      logger.error({ requestId, route }, "Request failed");
      captureException(error, { tags: { requestId, route } });
      return Response.json(
        { error: "Unable to complete request", requestId },
        { status: 500, headers: { "X-Request-ID": requestId } },
      );
    }
  };
}
