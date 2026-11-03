import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/src/lib/auth/session";
import { getEnv } from "@/src/config/env";
import { sameOrigin } from "@/src/lib/security/validation";
import { db } from "@/src/lib/db";
import { user, analyticsOutbox } from "@/src/lib/db/schema";
export async function POST(request: Request) {
  if (!sameOrigin(request, getEnv().APP_URL))
    return new Response(null, { status: 403 });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const body = z
    .object({ consent: z.boolean() })
    .safeParse(await request.json());
  if (!body.success) return new Response(null, { status: 400 });
  await db().transaction(async (tx) => {
    await tx
      .update(user)
      .set({ analyticsConsent: body.data.consent })
      .where(eq(user.id, session.user.id));
    if (!body.data.consent)
      await tx
        .delete(analyticsOutbox)
        .where(eq(analyticsOutbox.userId, session.user.id));
  });
  return Response.json({ ok: true });
}
