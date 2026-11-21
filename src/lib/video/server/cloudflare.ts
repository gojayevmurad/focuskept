// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { z } from "zod";
import { cloudflareResponseSchema } from "../protocol";
import type { VideoServerProvider } from "../types";
import { videoEnv } from "./config";
import { VideoError } from "./errors";

function hasError(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasError);
  const object = value as Record<string, unknown>;
  return (
    Boolean(object.errorCode || object.errorDescription) ||
    Object.values(object).some(hasError)
  );
}

async function request(
  url: string,
  token: string,
  method: string,
  body: unknown,
): Promise<unknown> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("upstream");
    const data: unknown = await response.json();
    if (hasError(data)) throw new Error("upstream");
    return data;
  } catch {
    // Upstream messages can contain SDP or credentials.
    throw new VideoError("Cloudflare video request failed", 502);
  }
}

export async function cloudflareRequest(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
) {
  const env = videoEnv();
  if (
    env.VIDEO_PROVIDER !== "cloudflare" ||
    !env.CLOUDFLARE_REALTIME_APP_ID ||
    !env.CLOUDFLARE_REALTIME_APP_TOKEN
  )
    throw new VideoError("Cloudflare video provider is not configured", 503);
  const data = await request(
    `https://rtc.live.cloudflare.com/v1/apps/${encodeURIComponent(env.CLOUDFLARE_REALTIME_APP_ID)}${path}`,
    env.CLOUDFLARE_REALTIME_APP_TOKEN,
    method,
    body,
  );
  const parsed = cloudflareResponseSchema.safeParse(data);
  if (!parsed.success)
    throw new VideoError("Invalid Cloudflare video response", 502);
  return parsed.data;
}

const iceServer = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});

export const cloudflareProvider: VideoServerProvider = {
  name: "cloudflare",
  async createRoom(focusSessionId) {
    return { roomId: focusSessionId };
  },
  async issueJoin({ focusSessionId }) {
    const env = videoEnv();
    let iceServers: RTCIceServer[] = [
      { urls: "stun:stun.cloudflare.com:3478" },
    ];
    if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_KEY_TOKEN) {
      const data = await request(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.CLOUDFLARE_TURN_KEY_ID)}/credentials/generate-ice-servers`,
        env.CLOUDFLARE_TURN_KEY_TOKEN,
        "POST",
        { ttl: 7200 },
      );
      const parsed = z
        .object({ iceServers: z.union([iceServer, z.array(iceServer).min(1)]) })
        .safeParse(data);
      if (!parsed.success)
        throw new VideoError("Invalid Cloudflare TURN response", 502);
      iceServers = Array.isArray(parsed.data.iceServers)
        ? parsed.data.iceServers
        : [parsed.data.iceServers];
    }
    return { provider: "cloudflare", sessionId: focusSessionId, iceServers };
  },
};
