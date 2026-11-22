// SPDX-License-Identifier: AGPL-3.0-only
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/src/config/env";

function getSecret(): string {
  try {
    const env = getEnv();
    if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 16) {
      return env.BETTER_AUTH_SECRET;
    }
  } catch {}
  return process.env.BETTER_AUTH_SECRET || "focuskept-default-unsubscribe-secret-fallback";
}

/**
 * Creates a signed, URL-safe token containing the userId for one-click unsubscribe.
 */
export function signUnsubscribeToken(userId: string): string {
  const secret = getSecret();
  const payload = Buffer.from(
    JSON.stringify({ u: userId, a: "unsubscribe_email_tips", t: Date.now() }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/**
 * Verifies an unsubscribe token and returns the userId if valid.
 */
export function verifyUnsubscribeToken(
  token: string | null | undefined,
): { userId: string } | null {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const secret = getSecret();
  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const data = JSON.parse(json);
    if (!data.u || typeof data.u !== "string") {
      return null;
    }
    return { userId: data.u };
  } catch {
    return null;
  }
}
