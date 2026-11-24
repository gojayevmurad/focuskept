// SPDX-License-Identifier: AGPL-3.0-only
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/src/lib/db";
import { avatarImage, profile } from "@/src/lib/db/schema";
import { getSession } from "@/src/lib/auth/session";
import { sameOrigin } from "@/src/lib/security/validation";
import { getEnv } from "@/src/config/env";
import { avatarType, MAX_AVATAR_BYTES } from "@/src/lib/profiles/avatar";
export const runtime = "nodejs";
async function mutate(req: Request) {
  const session = await getSession();
  if (!session?.user.emailVerified)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOrigin(req, getEnv().APP_URL))
    return Response.json({ error: "forbidden" }, { status: 403 });
  const userId = session.user.id;
  if (req.method === "DELETE") {
    await db().transaction(async (tx) => {
      await tx.delete(avatarImage).where(eq(avatarImage.userId, userId));
      await tx
        .update(profile)
        .set({ avatarUrl: null, updatedAt: new Date() })
        .where(eq(profile.userId, userId));
    });
    revalidatePath("/[locale]", "layout");
    return Response.json({ url: null });
  }
  if (Number(req.headers.get("content-length")) > MAX_AVATAR_BYTES + 16_384)
    return Response.json({ error: "size" }, { status: 413 });
  // Bound actual bytes too: Content-Length may be absent or untrusted.
  const reader = req.body?.getReader();
  if (!reader) return Response.json({ error: "type" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_AVATAR_BYTES + 16_384) {
        await reader.cancel();
        return Response.json({ error: "size" }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return Response.json({ error: "type" }, { status: 400 });
  }
  const form = await new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: { "Content-Type": req.headers.get("content-type") ?? "" },
  })
    .formData()
    .catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File))
    return Response.json({ error: "type" }, { status: 400 });
  if (file.size > MAX_AVATAR_BYTES)
    return Response.json({ error: "size" }, { status: 413 });
  const content = Buffer.from(await file.arrayBuffer());
  const contentType = avatarType(content);
  if (!contentType) return Response.json({ error: "type" }, { status: 400 });
  const updatedAt = new Date();
  const url = `/api/avatars/${encodeURIComponent(userId)}?v=${updatedAt.getTime()}`;
  await db().transaction(async (tx) => {
    await tx
      .insert(avatarImage)
      .values({ userId, content, contentType, updatedAt })
      .onConflictDoUpdate({
        target: avatarImage.userId,
        set: { content, contentType, updatedAt },
      });
    await tx
      .update(profile)
      .set({ avatarUrl: url, updatedAt })
      .where(eq(profile.userId, userId));
  });
  revalidatePath("/[locale]", "layout");
  return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
}
export const POST = mutate;
export const DELETE = mutate;
