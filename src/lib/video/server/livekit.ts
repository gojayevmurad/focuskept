import "server-only";
import { AccessToken } from "livekit-server-sdk";
import type { VideoServerProvider } from "../types";
import { videoEnv } from "./config";
import { VideoError } from "./errors";

export const livekitProvider: VideoServerProvider = {
  name: "livekit",
  async createRoom(focusSessionId) {
    return { roomId: `fk-${focusSessionId}` };
  },
  async issueJoin({ roomId, focusSessionId, userId, displayName }) {
    const env = videoEnv();
    if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET)
      throw new VideoError("LiveKit video provider is not configured", 503);
    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: userId,
      name: displayName,
      ttl: "2h",
    });
    token.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });
    return {
      provider: "livekit",
      url: env.LIVEKIT_URL,
      token: await token.toJwt(),
      sessionId: focusSessionId,
    };
  },
};
