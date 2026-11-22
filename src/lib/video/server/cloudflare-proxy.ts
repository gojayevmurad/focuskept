// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { sessionParticipant } from "@/src/lib/db/schema";
import { authorizeRoom } from "@/src/lib/sessions/access";
import { publish } from "@/src/lib/realtime/publish";
import { requestSchemas, type CloudflareAction } from "../protocol";
import type { TrackNames } from "../types";
import { cloudflareRequest } from "./cloudflare";
import { VideoError } from "./errors";
import { videoEnv } from "./config";
import { canPull, canAnnounce } from "./rules";

export async function cloudflareProxy(
  focusSessionId: string,
  userId: string,
  action: CloudflareAction,
  body: unknown,
) {
  const room = await authorizeRoom(focusSessionId, userId);
  if (!room) throw new VideoError("Session not found", 404);
  if (room.window !== "open")
    throw new VideoError("Video room is not open", 403);
  if (videoEnv().VIDEO_PROVIDER !== "cloudflare")
    throw new VideoError("Cloudflare video provider is not configured", 503);
  if (!requestSchemas[action].safeParse(body).success)
    throw new VideoError("Invalid video request", 400);

  return db().transaction(async (tx) => {
    const where = and(
      eq(sessionParticipant.sessionId, focusSessionId),
      eq(sessionParticipant.userId, userId),
    );
    // The row lock also serializes first-time session creation across web processes.
    const [caller] = await tx
      .select()
      .from(sessionParticipant)
      .where(where)
      .for("update");
    if (!caller) throw new VideoError("Session not found", 404);
    let sid = caller.videoSessionId;
    if (!sid) {
      const created = await cloudflareRequest("/sessions/new", "POST");
      if (!created.sessionId)
        throw new VideoError("Invalid Cloudflare session response", 502);
      sid = created.sessionId;
      await tx
        .update(sessionParticipant)
        .set({ videoSessionId: sid })
        .where(where);
    }
    const path = `/sessions/${encodeURIComponent(sid)}`;
    switch (action) {
      case "session":
        return { sessionId: sid };
      case "push": {
        const input = requestSchemas.push.parse(body);
        const tracks: TrackNames = { ...caller.tracks };
        const local = input.tracks.map(({ mid, kind }) => {
          const trackName = `${userId}-${kind}-${randomBytes(4).toString("hex")}`;
          tracks[kind] = trackName;
          return { location: "local", mid, trackName };
        });
        const result = await cloudflareRequest(`${path}/tracks/new`, "POST", {
          sessionDescription: input.sessionDescription,
          tracks: local,
        });
        if (result.sessionDescription?.type !== "answer")
          throw new VideoError("Invalid Cloudflare push answer", 502);
        return { answer: result.sessionDescription, tracks };
      }
      case "announce": {
        const input = requestSchemas.announce.parse(body);
        if (!canAnnounce(userId, input.tracks))
          throw new VideoError("Invalid track name", 400);
        const tracks: TrackNames = { ...caller.tracks, ...input.tracks };
        await tx.update(sessionParticipant).set({ tracks }).where(where);
        await publish(
          `session:${focusSessionId}`,
          "session.tracks",
          { userId, tracks },
          tx,
        );
        return { tracks };
      }
      case "pull": {
        const input = requestSchemas.pull.parse(body);
        const [target] = await tx
          .select()
          .from(sessionParticipant)
          .where(
            and(
              eq(sessionParticipant.sessionId, focusSessionId),
              eq(sessionParticipant.userId, input.targetUserId),
            ),
          );
        if (
          !input.trackNames.every((name) =>
            canPull(userId, focusSessionId, target, name),
          )
        )
          throw new VideoError("Participant tracks not found", 404);
        const result = await cloudflareRequest(
          `${path}/tracks/new`,
          "POST",
          {
            tracks: input.trackNames.map((trackName) => ({
              location: "remote",
              sessionId: target.videoSessionId,
              trackName,
              ...(input.lowQuality && trackName === target.tracks?.video
                ? { simulcast: { preferredRid: "l" } }
                : {}),
            })),
          },
          { allowTrackErrors: true },
        );
        return {
          ...result,
          // Error codes are enough for the browser to retry; descriptions stay here.
          tracks: result.tracks?.map((track) => ({
            ...track,
            errorDescription: undefined,
          })),
        };
      }
      case "renegotiate":
        return cloudflareRequest(
          `${path}/renegotiate`,
          "PUT",
          requestSchemas.renegotiate.parse(body),
        );
      case "close":
        return cloudflareRequest(`${path}/tracks/close`, "PUT", {
          ...requestSchemas.close.parse(body),
          force: false,
        });
    }
  });
}
