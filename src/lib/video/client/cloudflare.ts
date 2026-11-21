// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import {
  cloudflareResponseSchema,
  descriptionSchema,
  type CloudflareAction,
  type CloudflareResponse,
} from "../protocol";
import type {
  JoinCredentials,
  PublishOptions,
  RemoteParticipant,
  TrackNames,
  VideoClient,
} from "../types";
import { VideoEvents } from "./events";
import { summarizeStats, type VideoStatsEntry } from "./stats";

type Subscription = {
  participant: RemoteParticipant;
  lowQuality: boolean;
  stream: MediaStream;
  mids: Map<string, { name: string; kind: "audio" | "video" }>;
};
const pushResponse = z.object({
  answer: descriptionSchema.extend({ type: z.literal("answer") }),
  tracks: z.object({
    audio: z.string().optional(),
    video: z.string().optional(),
  }),
});

export class CloudflareVideoClient extends VideoEvents implements VideoClient {
  readonly provider = "cloudflare";
  private pc?: RTCPeerConnection;
  private sessionId?: string;
  private queue: Promise<unknown> = Promise.resolve();
  private subscriptions = new Map<string, Subscription>();
  private audio?: { sender: RTCRtpSender; track: MediaStreamTrack };
  private local = new Map<RTCRtpTransceiver, MediaStreamTrack>();
  private videoEnabled = true;
  private microphoneEnabled = true;
  private leaving = false;
  private timer?: ReturnType<typeof setInterval>;
  private previous?: VideoStatsEntry[];
  private qualityPrevious?: VideoStatsEntry[];
  private badChecks = 0;
  private goodChecks = 0;
  private reduced = false;

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  private connection(): RTCPeerConnection {
    if (!this.pc || this.pc.signalingState === "closed")
      throw new Error("Video is not connected");
    return this.pc;
  }

  private async request(
    action: CloudflareAction,
    body: unknown,
  ): Promise<unknown> {
    if (!this.sessionId) throw new Error("Video is not connected");
    const response = await fetch(
      `/api/video/cloudflare/${encodeURIComponent(this.sessionId)}/${action}`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok)
      throw new Error(`Video ${action} failed (${response.status})`);
    return response.json();
  }

  async join(credentials: JoinCredentials): Promise<void> {
    return this.enqueue(async () => {
      if (credentials.provider !== this.provider)
        throw new Error("Invalid video credentials");
      if (this.pc) throw new Error("Video is already connected");
      this.leaving = false;
      this.emit("connection", "connecting");
      this.sessionId = credentials.sessionId;
      const pc = new RTCPeerConnection({
        bundlePolicy: "max-bundle",
        iceServers: credentials.iceServers,
      });
      this.pc = pc;
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        this.emit(
          "connection",
          state === "disconnected"
            ? "reconnecting"
            : state === "new"
              ? "connecting"
              : state,
        );
      };
      pc.ontrack = ({ track, transceiver }) =>
        this.attachTrack(track, transceiver.mid);
      try {
        await this.request("session", {});
        this.timer = setInterval(() => {
          if (!this.leaving)
            void this.enqueue(() => this.adaptQuality()).catch(() => {});
        }, 5000);
      } catch (error) {
        pc.close();
        this.pc = undefined;
        this.emit("connection", "failed");
        throw error;
      }
    });
  }

  private attachTrack(track: MediaStreamTrack, mid: string | null) {
    if (!mid) return;
    for (const [userId, subscription] of this.subscriptions) {
      if (!subscription.mids.has(mid)) continue;
      if (!subscription.stream.getTrackById(track.id))
        subscription.stream.addTrack(track);
      track.onended = () => {
        subscription.stream.removeTrack(track);
        this.emit(
          "remote",
          userId,
          subscription.stream.getTracks().length ? subscription.stream : null,
        );
      };
      this.emit("remote", userId, subscription.stream);
      break;
    }
  }

  private async localDescription(
    type: "offer" | "answer",
  ): Promise<RTCSessionDescriptionInit> {
    const pc = this.connection();
    await pc.setLocalDescription(
      type === "offer" ? await pc.createOffer() : await pc.createAnswer(),
    );
    // There is no trickle ICE endpoint; send the candidates with the SDP.
    if (pc.iceGatheringState !== "complete") {
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          clearTimeout(timeout);
          pc.removeEventListener("icegatheringstatechange", check);
          pc.removeEventListener("connectionstatechange", closed);
        };
        const check = () => {
          if (pc.iceGatheringState === "complete") {
            finish();
            resolve();
          }
        };
        const closed = () => {
          if (pc.connectionState === "closed") {
            finish();
            reject(new Error("Video closed"));
          }
        };
        const timeout = setTimeout(() => {
          finish();
          reject(new Error("Video ICE gathering timed out"));
        }, 10_000);
        pc.addEventListener("icegatheringstatechange", check);
        pc.addEventListener("connectionstatechange", closed);
        check();
      });
    }
    const description = pc.localDescription;
    if (!description?.sdp) throw new Error("Missing local video description");
    return { type: description.type, sdp: description.sdp };
  }

  async publishTracks(
    stream: MediaStream,
    options: PublishOptions,
  ): Promise<TrackNames> {
    return this.enqueue(async () => {
      const pc = this.connection();
      if (this.local.size)
        throw new Error("Local tracks are already published");
      const added: {
        transceiver: RTCRtpTransceiver;
        kind: "audio" | "video";
      }[] = [];
      for (const kind of ["audio", "video"] as const) {
        if (!options[kind]) continue;
        const track = stream.getTracks().find((item) => item.kind === kind);
        if (!track) continue;
        const sendEncodings: RTCRtpEncodingParameters[] =
          kind === "video"
            ? options.simulcast
              ? [
                  {
                    rid: "l",
                    scaleResolutionDownBy: 2,
                    maxBitrate: 150_000,
                    maxFramerate: 15,
                  },
                  { rid: "h", maxBitrate: 600_000, maxFramerate: 24 },
                ]
              : [{ maxBitrate: 600_000, maxFramerate: 24 }]
            : [{}];
        const transceiver = pc.addTransceiver(track, {
          direction: "sendonly",
          sendEncodings,
        });
        this.local.set(transceiver, track);
        added.push({ transceiver, kind });
        if (kind === "audio") {
          this.audio = { sender: transceiver.sender, track };
          if (!this.microphoneEnabled)
            await transceiver.sender.replaceTrack(null);
        }
      }
      if (!added.length) return {};
      const sessionDescription = await this.localDescription("offer");
      const tracks = added.map(({ transceiver, kind }) => {
        if (transceiver.mid === null)
          throw new Error("Missing local video mid");
        return { mid: transceiver.mid, kind };
      });
      const result = pushResponse.parse(
        await this.request("push", { sessionDescription, tracks }),
      );
      await pc.setRemoteDescription(result.answer);
      return result.tracks;
    });
  }

  private async completeNegotiation(result: CloudflareResponse) {
    if (result.requiresImmediateRenegotiation) {
      if (result.sessionDescription?.type !== "offer")
        throw new Error("Missing video renegotiation offer");
      await this.connection().setRemoteDescription(result.sessionDescription);
      const sessionDescription = await this.localDescription("answer");
      await this.request("renegotiate", { sessionDescription });
    } else if (result.sessionDescription) {
      await this.connection().setRemoteDescription(result.sessionDescription);
    }
  }

  private async pull(subscription: Subscription) {
    const names = Object.entries(subscription.participant.tracks ?? {}).filter(
      ([kind, name]) =>
        name &&
        (kind !== "video" || this.videoEnabled) &&
        !Array.from(subscription.mids.values()).some(
          (track) => track.name === name,
        ),
    );
    if (!names.length) return;
    const result = cloudflareResponseSchema.parse(
      await this.request("pull", {
        targetUserId: subscription.participant.userId,
        trackNames: names.map(([, name]) => name),
        lowQuality: subscription.lowQuality,
      }),
    );
    for (const [kind, name] of names) {
      const track = result.tracks?.find((item) => item.trackName === name);
      if (!track?.mid || (kind !== "audio" && kind !== "video"))
        throw new Error("Missing pulled video mid");
      subscription.mids.set(track.mid, { name, kind });
    }
    await this.completeNegotiation(result);
    // A track event can precede the response that supplies its mid.
    for (const transceiver of this.connection().getTransceivers()) {
      if (transceiver.mid && subscription.mids.has(transceiver.mid))
        this.attachTrack(transceiver.receiver.track, transceiver.mid);
    }
  }

  private async closeMids(mids: string[]) {
    if (!mids.length) return;
    const pc = this.connection();
    const removed = new Map<string, MediaStreamTrack>();
    for (const transceiver of pc.getTransceivers()) {
      if (!transceiver.mid || !mids.includes(transceiver.mid)) continue;
      removed.set(transceiver.mid, transceiver.receiver.track);
      transceiver.stop();
    }
    const sessionDescription = await this.localDescription("offer");
    const result = cloudflareResponseSchema.parse(
      await this.request("close", {
        tracks: mids.map((mid) => ({ mid })),
        sessionDescription,
      }),
    );
    if (!result.sessionDescription)
      throw new Error("Missing video close description");
    await this.completeNegotiation(result);
    for (const [userId, subscription] of this.subscriptions) {
      for (const mid of mids) {
        if (!subscription.mids.delete(mid)) continue;
        const track = removed.get(mid);
        if (track) subscription.stream.removeTrack(track);
      }
      this.emit(
        "remote",
        userId,
        subscription.stream.getTracks().length ? subscription.stream : null,
      );
    }
  }

  async subscribe(
    participant: RemoteParticipant,
    options?: { lowQuality?: boolean },
  ): Promise<void> {
    return this.enqueue(async () => {
      this.connection();
      let subscription = this.subscriptions.get(participant.userId);
      if (!subscription) {
        subscription = {
          participant,
          lowQuality: options?.lowQuality ?? false,
          stream: new MediaStream(),
          mids: new Map(),
        };
        this.subscriptions.set(participant.userId, subscription);
      }
      const changedQuality =
        subscription.lowQuality !== (options?.lowQuality ?? false);
      const stale = Array.from(subscription.mids)
        .filter(
          ([, track]) =>
            participant.tracks?.[track.kind] !== track.name ||
            (track.kind === "video" && changedQuality),
        )
        .map(([mid]) => mid);
      await this.closeMids(stale);
      subscription.participant = participant;
      subscription.lowQuality = options?.lowQuality ?? false;
      await this.pull(subscription);
    });
  }

  async unsubscribe(userId: string): Promise<void> {
    return this.enqueue(async () => {
      const subscription = this.subscriptions.get(userId);
      if (!subscription) return;
      await this.closeMids(Array.from(subscription.mids.keys()));
      this.subscriptions.delete(userId);
      this.emit("remote", userId, null);
    });
  }

  async setMicrophone(enabled: boolean): Promise<void> {
    return this.enqueue(async () => {
      this.microphoneEnabled = enabled;
      if (this.audio)
        await this.audio.sender.replaceTrack(enabled ? this.audio.track : null);
    });
  }

  async setRemoteVideo(enabled: boolean): Promise<void> {
    return this.enqueue(async () => {
      this.videoEnabled = enabled;
      if (enabled) {
        for (const subscription of this.subscriptions.values())
          await this.pull(subscription);
      } else {
        const mids = Array.from(this.subscriptions.values()).flatMap(
          (subscription) =>
            Array.from(subscription.mids)
              .filter(([, track]) => track.kind === "video")
              .map(([mid]) => mid),
        );
        await this.closeMids(mids);
      }
    });
  }

  async getStats() {
    if (!this.pc || this.pc.signalingState === "closed") return {};
    const entries: VideoStatsEntry[] = Array.from(
      (await this.pc.getStats()).values(),
    );
    const stats = summarizeStats(entries, this.previous);
    this.previous = entries;
    return stats;
  }

  private async adaptQuality() {
    if (!this.pc || this.pc.connectionState !== "connected") return;
    const entries: VideoStatsEntry[] = Array.from(
      (await this.pc.getStats()).values(),
    );
    const previous = new Map(
      (this.qualityPrevious ?? []).map((entry) => [entry.id, entry]),
    );
    const selectedPairId = entries.find(
      (entry) => entry.type === "transport" && entry.selectedCandidatePairId,
    )?.selectedCandidatePairId;
    this.qualityPrevious = entries;
    const bad = entries.some((entry) => {
      if (
        entry.type === "outbound-rtp" &&
        (entry.kind ?? entry.mediaType) === "video"
      )
        return entry.qualityLimitationReason === "bandwidth";
      if (
        entry.type === "candidate-pair" &&
        (entry.id === selectedPairId ||
          entry.selected ||
          (entry.nominated && entry.state === "succeeded"))
      )
        return (
          entry.availableOutgoingBitrate !== undefined &&
          entry.availableOutgoingBitrate < 450_000
        );
      if (entry.type !== "remote-inbound-rtp") return false;
      if (entry.fractionLost !== undefined) return entry.fractionLost > 0.05;
      const old = previous.get(entry.id);
      const lost = Math.max(
        0,
        (entry.packetsLost ?? 0) - (old?.packetsLost ?? 0),
      );
      const received = Math.max(
        0,
        (entry.packetsReceived ?? 0) - (old?.packetsReceived ?? 0),
      );
      return lost + received > 0 && lost / (lost + received) > 0.05;
    });
    this.badChecks = bad ? this.badChecks + 1 : 0;
    this.goodChecks = bad ? 0 : this.goodChecks + 1;
    const reduce = this.reduced ? this.goodChecks < 4 : this.badChecks >= 2;
    if (reduce === this.reduced) return;
    for (const [transceiver, track] of this.local) {
      if (track.kind !== "video") continue;
      const parameters = transceiver.sender.getParameters();
      for (const encoding of parameters.encodings) {
        const low = encoding.rid === "l";
        encoding.scaleResolutionDownBy = low ? 2 : reduce ? 1.333 : 1;
        encoding.maxBitrate = low ? 150_000 : reduce ? 300_000 : 600_000;
        encoding.maxFramerate = low ? 15 : 24;
      }
      await transceiver.sender.setParameters(parameters);
    }
    this.reduced = reduce;
    this.emit("quality", reduce ? "reduced" : "good");
  }

  async leave(): Promise<void> {
    this.leaving = true;
    if (this.timer) clearInterval(this.timer);
    return this.enqueue(async () => {
      try {
        if (this.pc && this.pc.signalingState !== "closed") {
          const mids = [
            ...Array.from(this.local.keys()).flatMap((track) =>
              track.mid === null ? [] : [track.mid],
            ),
            ...Array.from(this.subscriptions.values()).flatMap((subscription) =>
              Array.from(subscription.mids.keys()),
            ),
          ];
          await this.closeMids(mids);
        }
      } finally {
        this.pc?.close();
        this.pc = undefined;
        for (const track of this.local.values()) track.stop();
        this.local.clear();
        this.audio = undefined;
        for (const userId of this.subscriptions.keys())
          this.emit("remote", userId, null);
        this.subscriptions.clear();
        this.previous = undefined;
        this.qualityPrevious = undefined;
        this.goodChecks = this.badChecks = 0;
        this.reduced = false;
        this.emit("connection", "closed");
      }
    });
  }
}
