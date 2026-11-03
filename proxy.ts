import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/src/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/** Request header carrying the current path, so protected layouts can send
 * signed-out visitors to sign-in and back again (always overwritten here). */
const PATH_HEADER = "x-fk-path";

// Locale detection and prefixing only. Authorization is never decided here:
// every protected page and endpoint checks the session on the server.
export default function proxy(request: NextRequest) {
  request.headers.set(
    PATH_HEADER,
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return handleI18nRouting(request);
}

export const config = {
  // Skip API routes, Next internals and any path with a file extension
  // (sw.js, manifest, icons, robots.txt, sitemap.xml, sounds).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
