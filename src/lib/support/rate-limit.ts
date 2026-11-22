// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { createHash } from "node:crypto";
import { rateLimit } from "@/src/lib/security/rate-limit";

/**
 * Creates a one-way SHA-256 hash of an IP address.
 * Raw IP addresses are never persisted in the database.
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`focuskept:ip:${ip}`).digest("hex");
}

/**
 * Enforces rate limiting on support ticket creation:
 * Maximum 5 tickets per hour per IP hash, and per user (if signed in).
 */
export async function checkSupportRateLimit(
  ip: string,
  userId?: string | null,
): Promise<boolean> {
  const ipHash = hashIp(ip || "127.0.0.1");
  const ipOk = await rateLimit(`support:ip:${ipHash}`, 5, 3600);
  if (!ipOk) return false;

  if (userId) {
    const userOk = await rateLimit(`support:user:${userId}`, 5, 3600);
    if (!userOk) return false;
  }

  return true;
}
