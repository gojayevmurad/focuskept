// SPDX-License-Identifier: AGPL-3.0-only
import {
  ConnectionQuality,
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant as LivekitParticipant,
} from "livekit-client";
import type {
  JoinCredentials,
  PublishOptions,
  RemoteParticipant,
  TrackNames,
  VideoClient,
} from "../types";
import { VideoEvents } from "./events";
import { summarizeStats, type VideoStatsEntry } from "./stats";

export class LivekitVideoClient extends VideoEvents implements VideoClient {
  readonly provider = "livekit";
  private room?: Room;
  private previous?: VideoStatsEntry[];
  private remoteVideo = true;
  private subscriptions = new Map<string, { lowQuality: boolean }>();

  private connection(): Room {
    if (!this.room) throw new Error("Video is not connected");
    return this.room;
  }

  async join(credentials: JoinCredentials): Promise<void> {
    if (credentials.provider !== this.provider)
      throw new Error("Invalid video credentials");
    if (this.room) throw new Error("Video is already connected");
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 640, height: 480, frameRate: 24 },
      },
      audioCaptureDefaults: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
    });
    this.room = room;
    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      this.emit(
        "connection",
        state === ConnectionState.Disconnected
          ? "closed"
          : state === ConnectionState.SignalReconnecting
            ? "reconnecting"
            : state,
      );
    });
    room.on(RoomEvent.TrackSubscribed, (_track, publication, participant) => {
      const subscription = this.subscriptions.get(participant.identity);
      if (
        !subscription ||
        (publication.kind === Track.Kind.Video && !this.remoteVideo)
      ) {
        publication.setSubscribed(false);
        return;
      }
      if (publication.kind === Track.Kind.Video) {
        // Consumers use MediaStream, so the SDK cannot observe their video elements.
        publication.setEnabled(true);
        publication.setVideoDimensions(
          subscription.lowQuality
            ? { width: 320, height: 240 }
            : { width: 640, height: 480 },
        );
      }
      this.emitRemote(participant);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) =>
      this.emitRemote(participant, track.mediaStreamTrack),
    );
    room.on(RoomEvent.ParticipantDisconnected, (participant) =>
      this.emit("remote", participant.identity, null),
    );
    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant === room.localParticipant)
        this.emit(
          "quality",
          quality === ConnectionQuality.Poor ||
            quality === ConnectionQuality.Lost
            ? "reduced"
            : "good",
        );
    });
    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      const subscription = this.subscriptions.get(participant.identity);
      if (subscription) {
        publication.setSubscribed(
          publication.kind !== Track.Kind.Video || this.remoteVideo,
        );
        if (publication.kind === Track.Kind.Video)
          publication.setVideoDimensions(
            subscription.lowQuality
              ? { width: 320, height: 240 }
              : { width: 640, height: 480 },
          );
      }
    });
    try {
      await room.connect(credentials.url, credentials.token, {
        autoSubscribe: false,
      });
    } catch (error) {
      await room.disconnect();
      this.room = undefined;
      this.emit("connection", "failed");
      throw error;
    }
  }

  private emitRemote(
    participant: LivekitParticipant,
    removed?: MediaStreamTrack,
  ) {
    const tracks = Array.from(participant.trackPublications.values()).flatMap(
      (publication) =>
        this.subscriptions.has(participant.identity) &&
        publication.isSubscribed &&
        publication.track &&
        publication.track.mediaStreamTrack !== removed
          ? [publication.track.mediaStreamTrack]
          : [],
    );
    this.emit(
      "remote",
      participant.identity,
      tracks.length ? new MediaStream(tracks) : null,
    );
  }

  async publishTracks(
    stream: MediaStream,
    options: PublishOptions,
  ): Promise<TrackNames> {
    const local = this.connection().localParticipant;
    const names: TrackNames = {};
    for (const kind of ["audio", "video"] as const) {
      if (!options[kind]) continue;
      const track = stream.getTracks().find((entry) => entry.kind === kind);
      if (!track) continue;
      if (kind === "video")
        await track.applyConstraints({
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 24 },
        });
      else
        await track.applyConstraints({
          echoCancellation: true,
          noiseSuppression: true,
        });
      const name = `${local.identity}-${kind}-${crypto.randomUUID().slice(0, 8)}`;
      await local.publishTrack(track, {
        name,
        source:
          kind === "audio" ? Track.Source.Microphone : Track.Source.Camera,
        ...(kind === "video"
          ? {
              videoEncoding: { maxBitrate: 600_000, maxFramerate: 24 },
              simulcast: options.simulcast ?? false,
            }
          : {}),
      });
      names[kind] = name;
    }
    return names;
  }

  async subscribe(
    participant: RemoteParticipant,
    options?: { lowQuality?: boolean },
  ): Promise<void> {
    this.subscriptions.set(participant.userId, {
      lowQuality: options?.lowQuality ?? false,
    });
    const remote = this.connection().remoteParticipants.get(participant.userId);
    if (!remote) return;
    for (const publication of remote.trackPublications.values()) {
      publication.setSubscribed(
        publication.kind !== Track.Kind.Video || this.remoteVideo,
      );
      if (publication.kind === Track.Kind.Video)
        publication.setVideoDimensions(
          options?.lowQuality
            ? { width: 320, height: 240 }
            : { width: 640, height: 480 },
        );
    }
  }

  async unsubscribe(userId: string): Promise<void> {
    this.subscriptions.delete(userId);
    const remote = this.connection().remoteParticipants.get(userId);
    if (remote)
      for (const publication of remote.trackPublications.values())
        publication.setSubscribed(false);
    this.emit("remote", userId, null);
  }

  async setMicrophone(enabled: boolean): Promise<void> {
    await this.connection().localParticipant.setMicrophoneEnabled(enabled, {
      noiseSuppression: true,
      echoCancellation: true,
    });
  }

  async setRemoteVideo(enabled: boolean): Promise<void> {
    this.remoteVideo = enabled;
    for (const participant of this.connection().remoteParticipants.values()) {
      if (!this.subscriptions.has(participant.identity)) continue;
      for (const publication of participant.videoTrackPublications.values()) {
        publication.setSubscribed(enabled);
        publication.setEnabled(enabled);
      }
    }
  }

  async getStats() {
    const manager = this.room?.engine?.pcManager;
    if (!manager) return {};
    const reports = await Promise.all([
      manager.publisher.getStats(),
      manager.subscriber?.getStats(),
    ]);
    const entries: VideoStatsEntry[] = reports.flatMap((report, index) =>
      report
        ? Array.from(report.values(), (entry: VideoStatsEntry) => ({
            ...entry,
            id: `${index}:${entry.id}`,
            ...(entry.localCandidateId
              ? { localCandidateId: `${index}:${entry.localCandidateId}` }
              : {}),
            ...(entry.selectedCandidatePairId
              ? {
                  selectedCandidatePairId: `${index}:${entry.selectedCandidatePairId}`,
                }
              : {}),
          }))
        : [],
    );
    const stats = summarizeStats(entries, this.previous);
    this.previous = entries;
    return stats;
  }

  async leave(): Promise<void> {
    await this.room?.disconnect();
    this.room = undefined;
    this.previous = undefined;
    for (const userId of this.subscriptions.keys())
      this.emit("remote", userId, null);
    this.subscriptions.clear();
    this.emit("connection", "closed");
  }
}
