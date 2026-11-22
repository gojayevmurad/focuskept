// SPDX-License-Identifier: AGPL-3.0-only
import type { NextRequest } from "next/server";
import type { Attribution } from "./types";
import { sanitizeAttribution } from "./cookie";

export function extractAttributionFromRequest(req: NextRequest): Attribution {
  const url = req.nextUrl;
  const searchParams = url.searchParams;

  const source = searchParams.get("utm_source") || undefined;
  const medium = searchParams.get("utm_medium") || undefined;
  const campaign = searchParams.get("utm_campaign") || undefined;
  const content = searchParams.get("utm_content") || undefined;
  const term = searchParams.get("utm_term") || undefined;

  let ref = searchParams.get("ref") || req.cookies.get("ref")?.value || undefined;
  if (!ref) {
    const pathname = url.pathname;
    const rMatch = pathname.match(/(?:^\/|\/[a-z]{2}\/)r\/([a-zA-Z0-9_-]+)/);
    if (rMatch) {
      ref = rMatch[1];
    } else {
      const uMatch = pathname.match(/(?:^\/|\/[a-z]{2}\/)u\/([a-zA-Z0-9_-]+)/);
      if (uMatch) {
        ref = uMatch[1];
      }
    }
  }

  let referrer: string | undefined;
  const refererHeader = req.headers.get("referer") || req.headers.get("referrer");
  if (refererHeader) {
    try {
      const refUrl = new URL(refererHeader);
      if (refUrl.hostname && refUrl.hostname !== url.hostname) {
        referrer = refUrl.hostname;
      }
    } catch {
      // Invalid URL in referer header
    }
  }

  const landingPath = url.pathname;
  const firstSeenAt = new Date().toISOString();

  return sanitizeAttribution({
    source,
    medium,
    campaign,
    content,
    term,
    ref,
    referrer,
    landingPath,
    firstSeenAt,
  });
}
