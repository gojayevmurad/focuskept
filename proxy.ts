// SPDX-License-Identifier: AGPL-3.0-only
import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "./src/i18n/routing";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  extractAttributionFromRequest,
  serializeAttributionCookie,
} from "./src/lib/attribution";

const handleI18nRouting = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  if (!request.cookies.has(ATTRIBUTION_COOKIE)) {
    const attribution = extractAttributionFromRequest(request);
    response.cookies.set(
      ATTRIBUTION_COOKIE,
      serializeAttributionCookie(attribution),
      {
        sameSite: "lax",
        maxAge: ATTRIBUTION_MAX_AGE,
        path: "/",
        secure: request.nextUrl.protocol === "https:",
      },
    );
  }

  return response;
}

export const config = {
  // Pages only: skip invite redirects, API routes, ingest proxy, Next internals and files with an extension.
  matcher: ["/((?!r/|api|ingest|_next|_vercel|.*\\..*).*)"],
};
