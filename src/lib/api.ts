import "server-only";
import { z } from "zod";
import { getEnv } from "@/src/config/env";
import { getVerifiedSession } from "@/src/lib/auth/session";
import { sameOrigin } from "@/src/lib/security/validation";
import { rateLimit } from "@/src/lib/security/rate-limit";

export type ApiUser = { id: string; email: string; name: string };

export function apiError(
  status: number,
  code: string,
  extra?: Record<string, unknown>,
) {
  return Response.json({ error: code, ...extra }, { status });
}

/**
 * Session check for route handlers. Mutations also require an exact
 * same-origin request (CSRF defence in depth on top of SameSite cookies).
 */
export async function requireApiUser(
  request: Request,
  { mutation = request.method !== "GET" }: { mutation?: boolean } = {},
): Promise<ApiUser | Response> {
  if (mutation && !sameOrigin(request, getEnv().APP_URL))
    return apiError(403, "forbidden");
  const session = await getVerifiedSession();
  if (!session) return apiError(401, "unauthorized");
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

/** Reads and validates a JSON body with a hard size limit. */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
  maxBytes = 64 * 1024,
): Promise<z.infer<T> | Response> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return apiError(413, "payload_too_large");
  const raw = await request.text();
  if (Buffer.byteLength(raw) > maxBytes)
    return apiError(413, "payload_too_large");
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : {};
  } catch {
    return apiError(400, "invalid_json");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) return apiError(400, "invalid_request");
  return parsed.data;
}

export async function limitOrReject(
  key: string,
  max: number,
  windowSeconds: number,
) {
  const result = await rateLimit(key, max, windowSeconds);
  if (result.allowed) return null;
  return Response.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
  );
}

export const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
