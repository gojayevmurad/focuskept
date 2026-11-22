// SPDX-License-Identifier: AGPL-3.0-only
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/src/lib/auth/session";
import { getEnv } from "@/src/config/env";
import { sameOrigin, isSafePushEndpoint } from "@/src/lib/security/validation";
import { rateLimit } from "@/src/lib/security/rate-limit";
import { db } from "@/src/lib/db";
import { pushSubscription } from "@/src/lib/db/schema";

export const runtime = "nodejs";

const schema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

async function guard(request: Request) {
  if (!sameOrigin(request, getEnv().APP_URL)) return null;
  const session = await getSession();
  return session?.user.emailVerified ? session.user : null;
}

export async function POST(request: Request) {
  const user = await guard(request);
  if (!user) return new Response(null, { status: 401 });
  if (!(await rateLimit(`push:${user.id}`, 20, 60))) {
    return new Response(null, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { endpoint, keys } = parsed.data;
  if (!isSafePushEndpoint(endpoint)) {
    return new Response(null, { status: 400 });
  }
  await db()
    .insert(pushSubscription)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
    });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await guard(request);
  if (!user) return new Response(null, { status: 401 });
  if (!(await rateLimit(`push:${user.id}`, 20, 60))) {
    return new Response(null, { status: 429 });
  }
  const parsed = z
    .object({ endpoint: z.string().max(1000) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!isSafePushEndpoint(parsed.data.endpoint)) {
    return new Response(null, { status: 400 });
  }
  await db()
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, user.id),
        eq(pushSubscription.endpoint, parsed.data.endpoint),
      ),
    );
  return Response.json({ ok: true });
}
