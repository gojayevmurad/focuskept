import { createHmac, timingSafeEqual } from "node:crypto";

export const UNSUBSCRIBE_CATEGORIES = ["reviews", "weekly"] as const;
export type UnsubscribeCategory = (typeof UNSUBSCRIBE_CATEGORIES)[number];

const b64 = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");

function signature(secret: string, payload: string) {
  // Domain-separated from every other use of the auth secret.
  return createHmac("sha256", secret)
    .update(`focuskept:unsubscribe:v1:${payload}`)
    .digest();
}

/** A stateless, non-expiring token for one-click unsubscribe links. */
export function signUnsubscribe(
  secret: string,
  userId: string,
  category: UnsubscribeCategory,
) {
  const payload = `${userId}.${category}`;
  return `${b64(payload)}.${b64(signature(secret, payload))}`;
}

export function verifyUnsubscribe(
  secret: string,
  token: string,
): { userId: string; category: UnsubscribeCategory } | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig || token.length > 400) return null;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = signature(secret, payload);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  const dot = payload.lastIndexOf(".");
  const userId = payload.slice(0, dot);
  const category = payload.slice(dot + 1) as UnsubscribeCategory;
  if (!userId || !UNSUBSCRIBE_CATEGORIES.includes(category)) return null;
  return { userId, category };
}

/** Constant-time bearer check for cron endpoints. */
export function bearerMatches(
  header: string | null,
  secret: string | undefined,
) {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = createHmac("sha256", "cron").update(header.slice(7)).digest();
  const expected = createHmac("sha256", "cron").update(secret).digest();
  return timingSafeEqual(given, expected);
}
