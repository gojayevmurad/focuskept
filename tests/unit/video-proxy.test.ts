// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { canPull } from "@/src/lib/video/server/rules";
import { requestSchemas } from "@/src/lib/video/protocol";

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
});
