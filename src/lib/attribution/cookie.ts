// SPDX-License-Identifier: AGPL-3.0-only
import type { Attribution } from "./types";

export const ATTRIBUTION_COOKIE = "fk_attr";
export const ATTRIBUTION_MAX_AGE = 90 * 24 * 60 * 60; // 90 days in seconds

const MAX_FIELD_LENGTH = 200;

function truncate(str: unknown): string | undefined {
  if (typeof str !== "string") return undefined;
  const trimmed = str.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_FIELD_LENGTH);
}

export function sanitizeAttribution(
  raw?: Partial<Attribution> | Record<string, unknown> | null,
): Attribution {
  if (!raw || typeof raw !== "object") return {};
  const sanitized: Attribution = {};

  if (raw.source) sanitized.source = truncate(raw.source);
  if (raw.medium) sanitized.medium = truncate(raw.medium);
  if (raw.campaign) sanitized.campaign = truncate(raw.campaign);
  if (raw.content) sanitized.content = truncate(raw.content);
  if (raw.term) sanitized.term = truncate(raw.term);
  if (raw.referrer) sanitized.referrer = truncate(raw.referrer);
  if (raw.landingPath) sanitized.landingPath = truncate(raw.landingPath);
  if (raw.ref) sanitized.ref = truncate(raw.ref);
  if (raw.firstSeenAt) sanitized.firstSeenAt = truncate(raw.firstSeenAt);

  return sanitized;
}

export function parseAttributionCookie(raw?: string | null): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeAttribution(parsed);
    return Object.keys(sanitized).length > 0 ? sanitized : null;
  } catch {
    return null;
  }
}

export function serializeAttributionCookie(data: Attribution): string {
  return JSON.stringify(sanitizeAttribution(data));
}

export function getAttributionFromDocument(): Attribution | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ATTRIBUTION_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(ATTRIBUTION_COOKIE.length + 1);
  try {
    return parseAttributionCookie(decodeURIComponent(value));
  } catch {
    return parseAttributionCookie(value);
  }
}
