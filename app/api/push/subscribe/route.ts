import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  apiError,
  limitOrReject,
  readJson,
  requireApiUser,
} from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { db } from "@/src/lib/db";
import { pushSubscription } from "@/src/lib/db/schema";
import { getEnv } from "@/src/config/env";

const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

/** Registers this browser for review reminders (one row per device). */
export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  if (!getEnv().VAPID_PUBLIC_KEY) return apiError(503, "push_unavailable");
  const limited = await limitOrReject(`push:${user.id}`, 20, 3600);
  if (limited) return limited;
  const body = await readJson(request, subscriptionSchema, 4096);
  if (body instanceof Response) return body;
  const values = {
    userId: user.id,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
  };
  // An endpoint belongs to one browser profile; it moves with whoever signs in there.
  await db()
    .insert(pushSubscription)
    .values({ id: crypto.randomUUID(), endpoint: body.endpoint, ...values })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: values });
  return new Response(null, { status: 204 });
}, "push-subscribe");

export const DELETE = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const body = await readJson(
    request,
    z.object({ endpoint: z.string().max(2000) }),
    4096,
  );
  if (body instanceof Response) return body;
  await db()
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, user.id),
        eq(pushSubscription.endpoint, body.endpoint),
      ),
    );
  return new Response(null, { status: 204 });
}, "push-subscribe");
