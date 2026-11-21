// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { focusSession } from "@/src/lib/db/schema";
import { authorizeRoom, getFocusSession } from "@/src/lib/sessions/access";
import type { VideoServerProvider } from "../types";
import { cloudflareProvider } from "./cloudflare";
import { livekitProvider } from "./livekit";
import { noneProvider } from "./none";
import { videoEnv } from "./config";
import { VideoError } from "./errors";

export function getVideoProvider(): VideoServerProvider {
  switch (videoEnv().VIDEO_PROVIDER) {
    case "cloudflare":
      return cloudflareProvider;
    case "livekit":
      return livekitProvider;
    case "none":
      return noneProvider;
  }
}

export async function ensureRoom(
  focusSessionId: string,
): Promise<{ roomId: string }> {
  const session = await getFocusSession(focusSessionId);
  if (!session) throw new VideoError("Session not found", 404);
  if (session.videoRoomId) return { roomId: session.videoRoomId };
  const { roomId } = await getVideoProvider().createRoom(focusSessionId);
  await db()
    .update(focusSession)
    .set({ videoRoomId: roomId })
    .where(
      and(
        eq(focusSession.id, focusSessionId),
        isNull(focusSession.videoRoomId),
      ),
    );
  const stored = await getFocusSession(focusSessionId);
  if (!stored?.videoRoomId) throw new VideoError("Session not found", 404);
  return { roomId: stored.videoRoomId };
}

export async function joinCredentials(
  focusSessionId: string,
  userId: string,
  displayName: string,
) {
  const room = await authorizeRoom(focusSessionId, userId);
  if (!room) throw new VideoError("Session not found", 404);
  if (room.window !== "open")
    throw new VideoError("Video room is not open", 403);
  const provider = getVideoProvider();
  const { roomId } = await ensureRoom(focusSessionId);
  return provider.issueJoin({ roomId, focusSessionId, userId, displayName });
}
