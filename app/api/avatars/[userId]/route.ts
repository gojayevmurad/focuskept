// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { avatarImage } from "@/src/lib/db/schema";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  const [image] = await db()
    .select()
    .from(avatarImage)
    .where(eq(avatarImage.userId, userId));
  if (!image)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const etag = `"${createHash("sha256").update(image.content).digest("hex")}"`;
  const versioned =
    new URL(req.url).searchParams.get("v") ===
    String(image.updatedAt.getTime());
  const headers = {
    "Content-Type": image.contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": versioned
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
    ETag: etag,
  };
  if (
    req.headers
      .get("if-none-match")
      ?.split(",")
      .some((value) => value.trim().replace(/^W\//, "") === etag)
  )
    return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(image.content), { headers });
}
