// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128);

export const credentialsSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});

export function safeRedirect(value: string | undefined | null): string {
  if (!value || typeof value !== "string") return "/dashboard";
  // Must start with exactly one forward slash, no protocol-relative "//",
  // and no backslashes, newlines, carriage returns, tabs, or control characters.
  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\r\n\t\0-\x1f]/.test(value)
  ) {
    return value;
  }
  return "/dashboard";
}

export function sameOrigin(request: Request, origin: string): boolean {
  try {
    const originHeader = request.headers.get("origin");
    if (!originHeader) return false;
    return originHeader === new URL(origin).origin;
  } catch {
    return false;
  }
}

/**
 * Validates that an outbound push endpoint URL is HTTPS and does not resolve
 * to private IP ranges, cloud metadata services, or loopback addresses (SSRF mitigation).
 */
export function isSafePushEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return false;
    }

    // Reject loopback, link-local / AWS metadata (169.254.169.254), and private RFC 1918 IPv4
    if (/^127\./.test(hostname)) return false;
    if (/^169\.254\./.test(hostname)) return false;
    if (/^10\./.test(hostname)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return false;
    if (/^192\.168\./.test(hostname)) return false;
    if (hostname === "0.0.0.0") return false;

    // Reject IPv6 loopback, link-local, and unique local
    if (hostname === "[::1]" || hostname === "::1") return false;
    if (hostname.startsWith("[fe80:") || hostname.startsWith("fe80:"))
      return false;
    if (hostname.startsWith("[fc00:") || hostname.startsWith("fc00:"))
      return false;
    if (hostname.startsWith("[fd00:") || hostname.startsWith("fd00:"))
      return false;

    return true;
  } catch {
    return false;
  }
}
