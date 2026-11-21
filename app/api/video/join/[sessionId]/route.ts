import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src/lib/db";
import { profile } from "@/src/lib/db/schema";
import { joinCredentials } from "@/src/lib/video/server";
import { VideoError } from "@/src/lib/video/server/errors";
import { videoRequest } from "@/src/lib/video/server/request";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  return videoRequest(request, "/api/video/join/[sessionId]", async (user) => {
    const text = await request.text();
    const body: unknown = text ? JSON.parse(text) : {};
    if (!z.object({}).strict().safeParse(body).success)
      throw new VideoError("Invalid video request", 400);
    const { sessionId } = await context.params;
    const [person] = await db()
      .select({ displayName: profile.displayName })
      .from(profile)
      .where(eq(profile.userId, user.id));
    return joinCredentials(
      sessionId,
      user.id,
      person?.displayName || user.name,
    );
  });
}
