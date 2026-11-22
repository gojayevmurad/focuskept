// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canAnnounce, canPull } from "@/src/lib/video/server/rules";
import { requestSchemas } from "@/src/lib/video/protocol";
import type { TrackNames } from "@/src/lib/video/types";

let callerData:
  | {
      userId: string;
      sessionId: string;
      videoSessionId: string | null;
      tracks: TrackNames | null;
    }
  | undefined;
let targetData:
  | {
      userId: string;
      sessionId: string;
      videoSessionId: string | null;
      tracks: TrackNames | null;
    }
  | undefined;
let updatedTracks: TrackNames | undefined;

const mockTx = {
  select: () => ({
    from: () => ({
      where: () => {
        const result = Promise.resolve(targetData ? [targetData] : []);
        return Object.assign(result, {
          for: async () => (callerData ? [callerData] : []),
        });
      },
    }),
  }),
  update: () => ({
    set: (data: { tracks?: TrackNames; videoSessionId?: string }) => {
      if (data.tracks) updatedTracks = data.tracks;
      return {
        where: async () => {},
      };
    },
  }),
};

vi.mock("@/src/lib/db", () => ({
  db: () => ({
    transaction: async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
      cb(mockTx),
  }),
}));

vi.mock("@/src/lib/sessions/access", () => ({
  authorizeRoom: vi.fn(async () => ({ window: "open" })),
}));

vi.mock("@/src/lib/video/server/config", () => ({
  videoEnv: vi.fn(() => ({
    VIDEO_PROVIDER: "cloudflare",
    CLOUDFLARE_REALTIME_APP_ID: "app-id",
    CLOUDFLARE_REALTIME_APP_TOKEN: "app-token",
  })),
}));

vi.mock("@/src/lib/realtime/publish", () => ({
  publish: vi.fn(async () => {}),
}));

import { cloudflareProxy } from "@/src/lib/video/server/cloudflare-proxy";
import { publish } from "@/src/lib/realtime/publish";

const target = {
  userId: "target",
  sessionId: "focus",
  videoSessionId: "cf-target",
  tracks: { audio: "target-audio", video: "target-video" },
};

describe("video pull authorization", () => {
  it("allows only the target's exact published track names in the same room", () => {
    expect(canPull("caller", "focus", target, "target-audio")).toBe(true);
    expect(canPull("caller", "focus", target, "target-video")).toBe(true);
    expect(canPull("caller", "focus", target, "forged-video")).toBe(false);
    expect(canPull("caller", "another-focus", target, "target-video")).toBe(
      false,
    );
    expect(canPull("target", "focus", target, "target-video")).toBe(false);
  });

  it("rejects absent participants, sessions, and tracks", () => {
    expect(canPull("caller", "focus", undefined, "target-video")).toBe(false);
    expect(
      canPull(
        "caller",
        "focus",
        { ...target, videoSessionId: null },
        "target-video",
      ),
    ).toBe(false);
    expect(
      canPull("caller", "focus", { ...target, tracks: null }, "target-video"),
    ).toBe(false);
    expect(canPull("caller", "focus", { ...target, tracks: {} }, "")).toBe(
      false,
    );
  });
});

describe("video announce authorization", () => {
  it("validates names issued to the caller and rejects names of another user or wrong kind", () => {
    expect(canAnnounce("caller", { audio: "caller-audio-1234abcd" })).toBe(
      true,
    );
    expect(canAnnounce("caller", { video: "caller-video-1234abcd" })).toBe(
      true,
    );
    expect(
      canAnnounce("caller", {
        audio: "caller-audio-1234abcd",
        video: "caller-video-1234abcd",
      }),
    ).toBe(true);
    expect(canAnnounce("caller", { audio: "other-audio-1234abcd" })).toBe(
      false,
    );
    expect(canAnnounce("caller", { video: "other-video-1234abcd" })).toBe(
      false,
    );
    expect(canAnnounce("caller", { audio: "caller-video-1234abcd" })).toBe(
      false,
    );
    expect(canAnnounce("caller", { video: "caller-audio-1234abcd" })).toBe(
      false,
    );
    expect(canAnnounce("caller", { audio: "caller-audio-" })).toBe(false);
    expect(canAnnounce("caller", {})).toBe(false);
  });
});

describe("video proxy validation", () => {
  const push = {
    sessionDescription: { type: "offer", sdp: "sdp" },
    tracks: [{ mid: "0", kind: "video" }],
  };

  it("accepts a bounded offer and rejects client assigned track names or session IDs", () => {
    expect(requestSchemas.push.safeParse(push).success).toBe(true);
    expect(
      requestSchemas.push.safeParse({ ...push, sessionId: "someone-else" })
        .success,
    ).toBe(false);
    expect(
      requestSchemas.push.safeParse({
        ...push,
        tracks: [{ ...push.tracks[0], trackName: "forged" }],
      }).success,
    ).toBe(false);
    expect(
      requestSchemas.pull.safeParse({
        targetUserId: "target",
        trackNames: ["target-video"],
        sessionId: "forged",
      }).success,
    ).toBe(false);
  });

  it("bounds SDP and mids and rejects duplicate kinds", () => {
    expect(
      requestSchemas.push.safeParse({
        ...push,
        sessionDescription: { type: "offer", sdp: "s".repeat(100_001) },
      }).success,
    ).toBe(false);
    expect(
      requestSchemas.push.safeParse({
        ...push,
        tracks: [{ mid: "x".repeat(33), kind: "video" }],
      }).success,
    ).toBe(false);
    expect(
      requestSchemas.push.safeParse({
        ...push,
        tracks: [...push.tracks, { mid: "1", kind: "video" }],
      }).success,
    ).toBe(false);
    expect(
      requestSchemas.renegotiate.safeParse({
        sessionDescription: { type: "offer", sdp: "sdp" },
      }).success,
    ).toBe(false);
  });

  it("validates announce request schemas", () => {
    expect(
      requestSchemas.announce.safeParse({
        tracks: { audio: "caller-audio-1" },
      }).success,
    ).toBe(true);
    expect(
      requestSchemas.announce.safeParse({
        tracks: { audio: "caller-audio-1", video: "caller-video-1" },
      }).success,
    ).toBe(true);
    expect(
      requestSchemas.announce.safeParse({
        tracks: { audio: 123 },
      }).success,
    ).toBe(false);
    expect(
      requestSchemas.announce.safeParse({
        tracks: { unknown: "x" },
      }).success,
    ).toBe(false);
    expect(
      requestSchemas.announce.safeParse({
        extra: "bad",
        tracks: {},
      }).success,
    ).toBe(false);
  });
});

describe("cloudflare proxy push, announce, and pull", () => {
  beforeEach(() => {
    callerData = {
      userId: "caller",
      sessionId: "focus",
      videoSessionId: "cf-caller",
      tracks: null,
    };
    targetData = {
      userId: "target",
      sessionId: "focus",
      videoSessionId: "cf-target",
      tracks: { audio: "target-audio", video: "target-video" },
    };
    updatedTracks = undefined;
    vi.clearAllMocks();
  });

  it("push forwards offer and returns answer and track names without publishing or updating participant tracks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          sessionDescription: { type: "answer", sdp: "answer" },
        }),
      ),
    );
    const res = (await cloudflareProxy("focus", "caller", "push", {
      sessionDescription: { type: "offer", sdp: "offer" },
      tracks: [{ mid: "0", kind: "audio" }],
    })) as { answer: { type: string; sdp: string }; tracks: TrackNames };
    expect(res.answer).toEqual({ type: "answer", sdp: "answer" });
    expect(res.tracks.audio).toMatch(/^caller-audio-[0-9a-f]{8}$/);
    expect(publish).not.toHaveBeenCalled();
    expect(updatedTracks).toBeUndefined();
  });

  it("announce validates track names, updates participant tracks, and publishes realtime event", async () => {
    // Rejects names of another user
    await expect(
      cloudflareProxy("focus", "caller", "announce", {
        tracks: { audio: "other-audio-1234abcd" },
      }),
    ).rejects.toThrow("Invalid track name");
    expect(publish).not.toHaveBeenCalled();

    // Rejects wrong kinds
    await expect(
      cloudflareProxy("focus", "caller", "announce", {
        tracks: { audio: "caller-video-1234abcd" },
      }),
    ).rejects.toThrow("Invalid track name");
    await expect(
      cloudflareProxy("focus", "caller", "announce", {
        tracks: { video: "caller-audio-1234abcd" },
      }),
    ).rejects.toThrow("Invalid track name");
    expect(publish).not.toHaveBeenCalled();

    // Accepts valid names, stores them, and publishes
    const validTracks = {
      audio: "caller-audio-1234abcd",
      video: "caller-video-1234abcd",
    };
    const res = await cloudflareProxy("focus", "caller", "announce", {
      tracks: validTracks,
    });
    expect(res).toEqual({ tracks: validTracks });
    expect(updatedTracks).toEqual(validTracks);
    expect(publish).toHaveBeenCalledWith(
      "session:focus",
      "session.tracks",
      { userId: "caller", tracks: validTracks },
      mockTx,
    );
  });

  it("pull returns partial results with errorCodes and stripped errorDescriptions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          sessionDescription: { type: "offer", sdp: "offer" },
          requiresImmediateRenegotiation: true,
          tracks: [
            { mid: "0", trackName: "target-audio" },
            {
              trackName: "target-video",
              errorCode: "empty_track_error",
              errorDescription: "sensitive remote peer description",
            },
          ],
        }),
      ),
    );
    const res = (await cloudflareProxy("focus", "caller", "pull", {
      targetUserId: "target",
      trackNames: ["target-audio", "target-video"],
    })) as {
      sessionDescription?: { type: string; sdp: string };
      requiresImmediateRenegotiation?: boolean;
      tracks: {
        mid?: string;
        trackName?: string;
        errorCode?: string;
        errorDescription?: string;
      }[];
    };
    expect(res.sessionDescription).toEqual({ type: "offer", sdp: "offer" });
    expect(res.requiresImmediateRenegotiation).toBe(true);
    expect(res.tracks).toEqual([
      { mid: "0", trackName: "target-audio" },
      { trackName: "target-video", errorCode: "empty_track_error" },
    ]);
    expect(res.tracks[1].errorDescription).toBeUndefined();
  });

  it("pull throws 502 for non-2xx responses or top-level errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ errorCode: "invalid_session" }), {
            status: 400,
          }),
      ),
    );
    await expect(
      cloudflareProxy("focus", "caller", "pull", {
        targetUserId: "target",
        trackNames: ["target-audio"],
      }),
    ).rejects.toThrow("Cloudflare video request failed");
  });
});
