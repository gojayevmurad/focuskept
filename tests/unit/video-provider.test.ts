// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
import { logger } from "@/src/lib/logger";
import {
  cloudflareProvider,
  cloudflareRequest,
} from "@/src/lib/video/server/cloudflare";
import { getVideoProvider } from "@/src/lib/video/server";

const input = {
  roomId: "focus",
  focusSessionId: "focus",
  userId: "caller",
  displayName: "Caller",
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VIDEO_PROVIDER", "cloudflare");
  vi.stubEnv("CLOUDFLARE_REALTIME_APP_ID", "test-app");
  vi.stubEnv("CLOUDFLARE_REALTIME_APP_TOKEN", "test-app-token");
  vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "");
  vi.stubEnv("CLOUDFLARE_TURN_KEY_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("video server providers", () => {
  it("selects none and uses the focus session id without a transport", async () => {
    vi.stubEnv("VIDEO_PROVIDER", "none");
    const provider = getVideoProvider();
    expect(await provider.createRoom("focus")).toEqual({ roomId: "focus" });
    expect(await provider.issueJoin(input)).toEqual({
      provider: "none",
      sessionId: "focus",
    });
  });

  it("signs a LiveKit token limited to the room, caller, and two hours", async () => {
    const secret = "test-secret-at-least-thirty-two-characters";
    vi.stubEnv("VIDEO_PROVIDER", "livekit");
    vi.stubEnv("LIVEKIT_URL", "wss://video.example.test");
    vi.stubEnv("LIVEKIT_API_KEY", "test-key");
    vi.stubEnv("LIVEKIT_API_SECRET", secret);
    const provider = getVideoProvider();
    const room = await provider.createRoom("focus");
    expect(room).toEqual({ roomId: "fk-focus" });
    const credentials = await provider.issueJoin({ ...input, ...room });
    if (credentials.provider !== "livekit")
      throw new Error("Expected LiveKit credentials");
    const claims = await new TokenVerifier("test-key", secret).verify(
      credentials.token,
    );
    expect(claims.sub).toBe("caller");
    expect(claims.name).toBe("Caller");
    expect(claims.video).toMatchObject({
      roomJoin: true,
      room: "fk-focus",
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });
    expect(Number(claims.exp) - Number(claims.nbf)).toBe(7200);
  });

  it("returns a clear 503 when provider credentials are missing", () => {
    vi.stubEnv("CLOUDFLARE_REALTIME_APP_TOKEN", "");
    expect(() => getVideoProvider()).toThrow(
      expect.objectContaining({
        status: 503,
        message: expect.stringContaining("not configured"),
      }),
    );
  });
});

describe("Cloudflare API boundary", () => {
  it.each(["omitted", "undefined"])(
    "creates a session without a body or Content-Type when the body is %s",
    async (bodyMode) => {
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json({ sessionId: "cf-session" }, { status: 201 }),
      );
      vi.stubGlobal("fetch", fetcher);
      const result =
        bodyMode === "omitted"
          ? await cloudflareRequest("/sessions/new", "POST")
          : await cloudflareRequest("/sessions/new", "POST", undefined);
      expect(result).toEqual({ sessionId: "cf-session" });
      expect(fetcher).toHaveBeenCalledExactlyOnceWith(
        "https://rtc.live.cloudflare.com/v1/apps/test-app/sessions/new",
        expect.objectContaining({
          method: "POST",
          signal: expect.any(AbortSignal),
          cache: "no-store",
          headers: { Authorization: "Bearer test-app-token" },
        }),
      );
      const init = fetcher.mock.calls[0][1];
      expect(init).not.toHaveProperty("body");
      expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    },
  );

  it.each([
    {
      operation: "push",
      path: "/sessions/cf-session/tracks/new",
      method: "POST" as const,
      body: {
        sessionDescription: { type: "offer", sdp: "local-offer" },
        tracks: [{ location: "local", mid: "0", trackName: "caller-video" }],
      },
    },
    {
      operation: "pull",
      path: "/sessions/cf-session/tracks/new",
      method: "POST" as const,
      body: {
        tracks: [
          {
            location: "remote",
            sessionId: "cf-target",
            trackName: "target-video",
          },
        ],
      },
    },
    {
      operation: "renegotiate",
      path: "/sessions/cf-session/renegotiate",
      method: "PUT" as const,
      body: { sessionDescription: { type: "answer", sdp: "local-answer" } },
    },
    {
      operation: "close",
      path: "/sessions/cf-session/tracks/close",
      method: "PUT" as const,
      body: {
        tracks: [{ mid: "0" }],
        sessionDescription: { type: "offer", sdp: "close-offer" },
        force: false,
      },
    },
  ])("sends authorized JSON for $operation", async ({ path, method, body }) => {
    const fetcher = vi.fn(async () =>
      Response.json({ sessionId: "cf-session" }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await cloudflareRequest(path, method, body)).toEqual({
      sessionId: "cf-session",
    });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      `https://rtc.live.cloudflare.com/v1/apps/test-app${path}`,
      expect.objectContaining({
        method,
        body: JSON.stringify(body),
        signal: expect.any(AbortSignal),
        headers: {
          Authorization: "Bearer test-app-token",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it.each([
    { errorCode: "invalid", errorDescription: "private SDP" },
    { tracks: [{ errorCode: "invalid", errorDescription: "private SDP" }] },
  ])("rejects upstream errors without exposing the response", async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body)),
    );
    await expect(
      cloudflareRequest("/sessions/new", "POST"),
    ).rejects.toMatchObject({
      status: 502,
      message: "Cloudflare video request failed",
    });
  });

  it("rejects an upstream HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("private SDP", { status: 500 })),
    );
    await expect(
      cloudflareRequest("/sessions/new", "POST"),
    ).rejects.toMatchObject({
      status: 502,
      message: "Cloudflare video request failed",
    });
  });

  it("logs a warning with the error code and excludes the SDP", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
    const secretSdp = "v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\n";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          errorCode: "INVALID_SDP",
          errorDescription: "Failed to parse SDP offer",
          sessionDescription: { type: "offer", sdp: secretSdp },
        }),
      ),
    );

    await expect(
      cloudflareRequest("/sessions/cf-session/tracks/new", "POST"),
    ).rejects.toMatchObject({
      status: 502,
      message: "Cloudflare video request failed",
    });

    expect(warn).toHaveBeenCalledOnce();
    const [payload] = warn.mock.calls[0];
    expect(payload).toMatchObject({
      path: "/sessions/:id/tracks/new",
      status: 200,
      errors: [
        {
          errorCode: "INVALID_SDP",
          errorDescription: "Failed to parse SDP offer",
        },
      ],
    });
    expect(JSON.stringify(payload)).toContain("INVALID_SDP");
    expect(JSON.stringify(payload)).not.toContain(secretSdp);
    expect(JSON.stringify(payload)).not.toContain("cf-session");
  });

  it("logs a warning with track error codes and excludes track metadata and SDP", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
    const secretSdp = "v=0\r\no=- 78910 2 IN IP4 127.0.0.1\r\ns=-\r\n";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          tracks: [
            {
              errorCode: "TRACK_FAILED",
              errorDescription: "Failed to negotiate track",
              trackName: "private-track-name",
            },
          ],
          sessionDescription: { type: "answer", sdp: secretSdp },
        }),
      ),
    );

    await expect(
      cloudflareRequest("/sessions/cf-session/tracks/new", "POST"),
    ).rejects.toMatchObject({
      status: 502,
      message: "Cloudflare video request failed",
    });

    expect(warn).toHaveBeenCalledOnce();
    const [payload] = warn.mock.calls[0];
    expect(payload).toMatchObject({
      path: "/sessions/:id/tracks/new",
      status: 200,
      errors: [
        {
          errorCode: "TRACK_FAILED",
          errorDescription: "Failed to negotiate track",
        },
      ],
    });
    expect(JSON.stringify(payload)).toContain("TRACK_FAILED");
    expect(JSON.stringify(payload)).not.toContain(secretSdp);
    expect(JSON.stringify(payload)).not.toContain("private-track-name");
    expect(JSON.stringify(payload)).not.toContain("cf-session");
  });

  it("logs only status and path when upstream failure body is not JSON", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
    const secretSdp = "v=0\r\no=- 55555 2 IN IP4 127.0.0.1\r\ns=-\r\n";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(secretSdp, { status: 500 })),
    );

    await expect(
      cloudflareRequest("/sessions/cf-session/renegotiate", "PUT"),
    ).rejects.toMatchObject({
      status: 502,
      message: "Cloudflare video request failed",
    });

    expect(warn).toHaveBeenCalledOnce();
    const [payload] = warn.mock.calls[0];
    expect(payload).toEqual({
      path: "/sessions/:id/renegotiate",
      status: 500,
    });
    expect(JSON.stringify(payload)).not.toContain(secretSdp);
    expect(JSON.stringify(payload)).not.toContain("cf-session");
  });

  it.each(["single", "array"])(
    "normalizes a %s TURN response to iceServers",
    async (shape) => {
      vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "turn-key");
      vi.stubEnv("CLOUDFLARE_TURN_KEY_TOKEN", "turn-token");
      const server = {
        urls: ["turn:turn.example.test"],
        username: "user",
        credential: "short-lived",
      };
      const fetcher = vi.fn(async () =>
        Response.json({ iceServers: shape === "single" ? server : [server] }),
      );
      vi.stubGlobal("fetch", fetcher);
      expect(await cloudflareProvider.issueJoin(input)).toEqual({
        provider: "cloudflare",
        sessionId: "focus",
        iceServers: [server],
      });
      expect(fetcher).toHaveBeenCalledWith(
        "https://rtc.live.cloudflare.com/v1/turn/keys/turn-key/credentials/generate-ice-servers",
        expect.objectContaining({
          method: "POST",
          body: '{"ttl":7200}',
          headers: {
            Authorization: "Bearer turn-token",
            "Content-Type": "application/json",
          },
        }),
      );
    },
  );

  it("falls back to public STUN when no TURN credentials are configured", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await cloudflareProvider.issueJoin(input)).toEqual({
      provider: "cloudflare",
      sessionId: "focus",
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
