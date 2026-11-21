// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareVideoClient } from "@/src/lib/video/client/cloudflare";
import {
  requestSchemas,
  type CloudflareAction,
} from "@/src/lib/video/protocol";
import type { VideoStatsEntry } from "@/src/lib/video/client/stats";

class MediaTrack {
  onended: (() => void) | null = null;
  stop = vi.fn();
  constructor(
    readonly kind: string,
    readonly id: string,
  ) {}
}

class Stream {
  constructor(private tracks: MediaTrack[] = []) {}
  getTracks() {
    return [...this.tracks];
  }
  getTrackById(id: string) {
    return this.tracks.find((track) => track.id === id);
  }
  addTrack(track: MediaTrack) {
    this.tracks.push(track);
  }
  removeTrack(track: MediaTrack) {
    this.tracks = this.tracks.filter((item) => item !== track);
  }
}

class Transceiver {
  stopped = false;
  mid: string | null;
  receiver: { track: MediaTrack };
  sender: {
    track: MediaTrack | null;
    replaceTrack: ReturnType<
      typeof vi.fn<(track: MediaTrack | null) => Promise<void>>
    >;
    getParameters: () => { encodings: RTCRtpEncodingParameters[] };
    setParameters: ReturnType<
      typeof vi.fn<
        (parameters: { encodings: RTCRtpEncodingParameters[] }) => Promise<void>
      >
    >;
  };
  constructor(
    mid: string,
    track: MediaTrack,
    encodings: RTCRtpEncodingParameters[] = [],
  ) {
    this.mid = mid;
    this.receiver = { track };
    this.sender = {
      track,
      replaceTrack: vi.fn(async (value) => {
        this.sender.track = value;
      }),
      getParameters: () => ({
        encodings: encodings.map((encoding) => ({ ...encoding })),
      }),
      setParameters: vi.fn(async (parameters) => {
        encodings = parameters.encodings;
      }),
    };
  }
  stop() {
    this.stopped = true;
  }
}

class PeerConnection {
  static current: PeerConnection;
  connectionState = "connected";
  signalingState = "stable";
  iceGatheringState = "complete";
  localDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack:
    ((event: { track: MediaTrack; transceiver: Transceiver }) => void) | null =
    null;
  transceivers: Transceiver[] = [];
  stats: VideoStatsEntry[] = [];
  constructor(readonly config: RTCConfiguration) {
    PeerConnection.current = this;
  }
  addTransceiver(track: MediaTrack, init: RTCRtpTransceiverInit) {
    const transceiver = new Transceiver(
      String(this.transceivers.length),
      track,
      init.sendEncodings,
    );
    this.transceivers.push(transceiver);
    return transceiver;
  }
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "offer" }));
  createAnswer = vi.fn(async () => ({ type: "answer", sdp: "answer" }));
  async setLocalDescription(description: RTCSessionDescriptionInit) {
    if (
      this.signalingState !==
      (description.type === "offer" ? "stable" : "have-remote-offer")
    )
      throw new Error("Overlapping negotiation");
    this.localDescription = description;
    this.signalingState =
      description.type === "offer" ? "have-local-offer" : "stable";
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    if (description.type === "answer") {
      if (this.signalingState !== "have-local-offer")
        throw new Error("Unexpected answer");
      this.signalingState = "stable";
      for (const transceiver of this.transceivers)
        if (transceiver.stopped) transceiver.mid = null;
    } else {
      if (this.signalingState !== "stable") throw new Error("Unexpected offer");
      this.signalingState = "have-remote-offer";
      for (const transceiver of this.transceivers)
        if (!transceiver.stopped)
          this.ontrack?.({ track: transceiver.receiver.track, transceiver });
    }
  }
  getTransceivers() {
    return this.transceivers;
  }
  async getStats() {
    return new Map(this.stats.map((entry) => [entry.id, entry]));
  }
  close() {
    this.signalingState = "closed";
    this.connectionState = "closed";
  }
}

type RequestCall = {
  action: CloudflareAction;
  method: string | undefined;
  body: unknown;
};
let calls: RequestCall[];
let renegotiate: (() => Promise<void>) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  renegotiate = undefined;
  vi.stubGlobal("RTCPeerConnection", PeerConnection);
  vi.stubGlobal("MediaStream", Stream);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const action = url.split("/").at(-1) as CloudflareAction;
      const body: unknown = JSON.parse(String(init.body));
      calls.push({ action, method: init.method, body });
      expect(init.credentials).toBe("same-origin");
      expect(requestSchemas[action].safeParse(body).success).toBe(true);
      switch (action) {
        case "session":
          return Response.json({ sessionId: "own-session" });
        case "push":
          return Response.json({
            answer: { type: "answer", sdp: "answer" },
            tracks: { audio: "own-audio", video: "own-video" },
          });
        case "pull": {
          const input = requestSchemas.pull.parse(body);
          const tracks = input.trackNames.map((trackName) => {
            const mid = String(PeerConnection.current.transceivers.length);
            PeerConnection.current.transceivers.push(
              new Transceiver(
                mid,
                new MediaTrack(
                  trackName.includes("audio") ? "audio" : "video",
                  `${input.targetUserId}-${mid}`,
                ),
              ),
            );
            return { mid, trackName, sessionId: "remote-session" };
          });
          return Response.json({
            sessionDescription: { type: "offer", sdp: "offer" },
            requiresImmediateRenegotiation: true,
            tracks,
          });
        }
        case "renegotiate":
          await renegotiate?.();
          return Response.json({});
        case "close":
          return Response.json({
            sessionDescription: { type: "answer", sdp: "answer" },
            requiresImmediateRenegotiation: false,
          });
      }
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const credentials = {
  provider: "cloudflare",
  sessionId: "focus",
  iceServers: [{ urls: "stun:example.com" }],
} as const;
const participant = {
  userId: "target",
  displayName: "Target",
  tracks: { audio: "target-audio", video: "target-video" },
};

async function joined() {
  const client = new CloudflareVideoClient();
  await client.join({
    ...credentials,
    iceServers: [...credentials.iceServers],
  });
  return client;
}

describe("Cloudflare browser adapter", () => {
  it("publishes capped simulcast encodings and removes/restores the sender track when muted", async () => {
    const client = await joined();
    const audio = new MediaTrack("audio", "mic");
    const video = new MediaTrack("video", "camera");
    const names = await client.publishTracks(
      new Stream([audio, video]) as unknown as MediaStream,
      { audio: true, video: true, simulcast: true },
    );
    expect(names).toEqual({ audio: "own-audio", video: "own-video" });
    expect(PeerConnection.current.config.bundlePolicy).toBe("max-bundle");
    expect(
      PeerConnection.current.transceivers[1].sender.getParameters().encodings,
    ).toEqual([
      {
        rid: "l",
        scaleResolutionDownBy: 2,
        maxBitrate: 150_000,
        maxFramerate: 15,
      },
      { rid: "h", maxBitrate: 600_000, maxFramerate: 24 },
    ]);
    await client.setMicrophone(false);
    expect(PeerConnection.current.transceivers[0].sender.track).toBeNull();
    await client.setMicrophone(true);
    expect(PeerConnection.current.transceivers[0].sender.track).toBe(audio);
    await client.leave();
    expect(audio.stop).toHaveBeenCalledOnce();
    expect(video.stop).toHaveBeenCalledOnce();
  });

  it("closes only remote video and re-pulls its stored name while preserving audio", async () => {
    const client = await joined();
    let stream: MediaStream | null = null;
    client.on("remote", (_userId, value) => {
      stream = value;
    });
    await client.subscribe(participant, { lowQuality: true });
    const kinds = () =>
      (stream as MediaStream | null)
        ?.getTracks()
        .map((track) => track.kind)
        .sort();
    expect(kinds()).toEqual(["audio", "video"]);
    await client.setRemoteVideo(false);
    expect(kinds()).toEqual(["audio"]);
    expect(
      requestSchemas.close.parse(
        calls.find((call) => call.action === "close")?.body,
      ).tracks,
    ).toEqual([{ mid: "1" }]);
    await client.setRemoteVideo(true);
    expect(kinds()).toEqual(["audio", "video"]);
    expect(
      requestSchemas.pull.parse(
        calls.filter((call) => call.action === "pull").at(-1)?.body,
      ),
    ).toEqual({
      targetUserId: "target",
      trackNames: ["target-video"],
      lowQuality: true,
    });
    expect(calls.every((call) => call.method === "POST")).toBe(true);
    await client.unsubscribe("target");
    expect(stream).toBeNull();
    await client.leave();
  });

  it("holds subsequent signaling until the renegotiation response completes", async () => {
    const client = await joined();
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
    renegotiate = () =>
      new Promise<void>((resolve) => {
        release = resolve;
        started?.();
      });
    const first = client.subscribe(participant);
    await waiting;
    const second = client.subscribe({ ...participant, userId: "another" });
    await Promise.resolve();
    expect(calls.filter((call) => call.action === "pull")).toHaveLength(1);
    renegotiate = undefined;
    release?.();
    await Promise.all([first, second]);
    expect(calls.filter((call) => call.action === "pull")).toHaveLength(2);
    await client.leave();
  });

  it("reduces quality after two bad samples and restores it after four good samples", async () => {
    const client = await joined();
    await client.publishTracks(
      new Stream([new MediaTrack("video", "camera")]) as unknown as MediaStream,
      { audio: false, video: true },
    );
    const quality = vi.fn();
    client.on("quality", quality);
    PeerConnection.current.stats = [
      {
        id: "out",
        type: "outbound-rtp",
        timestamp: 0,
        kind: "video",
        qualityLimitationReason: "bandwidth",
      },
    ];
    await vi.advanceTimersByTimeAsync(5000);
    expect(quality).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(quality).toHaveBeenLastCalledWith("reduced");
    expect(
      PeerConnection.current.transceivers[0].sender.getParameters()
        .encodings[0],
    ).toMatchObject({ scaleResolutionDownBy: 1.333, maxBitrate: 300_000 });
    PeerConnection.current.stats = [];
    await vi.advanceTimersByTimeAsync(15_000);
    expect(quality).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(quality).toHaveBeenLastCalledWith("good");
    expect(
      PeerConnection.current.transceivers[0].sender.getParameters()
        .encodings[0],
    ).toMatchObject({ scaleResolutionDownBy: 1, maxBitrate: 600_000 });
    await client.leave();
  });
});
