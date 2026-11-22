// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { z } from "zod";
import { logger } from "@/src/lib/logger";
import { cloudflareResponseSchema } from "../protocol";
import type { VideoServerProvider } from "../types";
import { videoEnv } from "./config";
import { VideoError } from "./errors";

type CloudflareErrorInfo = {
  errorCode?: unknown;
  errorDescription?: string;
};

function truncateDescription(value: unknown): string | undefined {
  if (typeof value === "string") return value.slice(0, 200);
  if (value !== undefined && value !== null) return String(value).slice(0, 200);
  return undefined;
}

function collectErrors(data: unknown): CloudflareErrorInfo[] {
  if (!data || typeof data !== "object") return [];
  const errors: CloudflareErrorInfo[] = [];
  const record = data as Record<string, unknown>;

  if (record.errorCode !== undefined || record.errorDescription !== undefined) {
    const error: CloudflareErrorInfo = {};
    if (record.errorCode !== undefined) {
      error.errorCode = record.errorCode;
    }
    const desc = truncateDescription(record.errorDescription);
    if (desc !== undefined) {
      error.errorDescription = desc;
    }
    errors.push(error);
  }

  if (Array.isArray(record.tracks)) {
    for (const track of record.tracks) {
      if (track && typeof track === "object") {
        const trackRecord = track as Record<string, unknown>;
        if (
          trackRecord.errorCode !== undefined ||
          trackRecord.errorDescription !== undefined
        ) {
          const error: CloudflareErrorInfo = {};
          if (trackRecord.errorCode !== undefined) {
            error.errorCode = trackRecord.errorCode;
          }
          const desc = truncateDescription(trackRecord.errorDescription);
          if (desc !== undefined) {
            error.errorDescription = desc;
          }
          errors.push(error);
        }
      }
    }
  }

  return errors;
}

function safeRoute(path: string): string {
  return path
    .replace(/^\/sessions\/(?!new(?:\/|$))[^/]+/, "/sessions/:id")
    .replace(/^\/turn\/keys\/[^/]+/, "/turn/keys/:id");
}

function hasError(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasError);
  const object = value as Record<string, unknown>;
  return (
    Boolean(object.errorCode || object.errorDescription) ||
    Object.values(object).some(hasError)
  );
}

function hasTopLevelError(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return Boolean(record.errorCode || record.errorDescription);
}

async function request(
  route: string,
  url: string,
  token: string,
  method: string,
  body?: unknown,
  options?: { allowTrackErrors?: boolean },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new VideoError("Cloudflare video request failed", 502);
  }

  let data: unknown;
  let isJson = false;
  try {
    data = await response.json();
    isJson = true;
  } catch {
    isJson = false;
  }

  const ok =
    response.ok &&
    isJson &&
    (options?.allowTrackErrors ? !hasTopLevelError(data) : !hasError(data));

  if (ok) {
    return data;
  }

  const logPayload: {
    path: string;
    status: number;
    errors?: CloudflareErrorInfo[];
  } = {
    path: route,
    status: response.status,
  };

  if (isJson) {
    const errors = collectErrors(data);
    if (errors.length > 0) {
      logPayload.errors = errors;
    }
  }

  logger.warn(logPayload, "Cloudflare video request failed");
  throw new VideoError("Cloudflare video request failed", 502);
}

export async function cloudflareRequest(
  path: string,
  method: "POST" | "PUT",
  body?: unknown,
  options?: { allowTrackErrors?: boolean },
) {
  const env = videoEnv();
  if (
    env.VIDEO_PROVIDER !== "cloudflare" ||
    !env.CLOUDFLARE_REALTIME_APP_ID ||
    !env.CLOUDFLARE_REALTIME_APP_TOKEN
  )
    throw new VideoError("Cloudflare video provider is not configured", 503);
  const route = safeRoute(path);
  const data = await request(
    route,
    `https://rtc.live.cloudflare.com/v1/apps/${encodeURIComponent(env.CLOUDFLARE_REALTIME_APP_ID)}${path}`,
    env.CLOUDFLARE_REALTIME_APP_TOKEN,
    method,
    body,
    options,
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
        "/turn/keys/:id/credentials/generate-ice-servers",
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
