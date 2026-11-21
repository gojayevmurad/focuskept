// Contract between the UI and the video providers. The UI imports only this
// file and `client/index.ts`; it never talks to a provider directly.

export type VideoProviderName = "cloudflare" | "livekit" | "none";

export type TrackNames = { audio?: string; video?: string };

export type JoinCredentials =
  | {
      provider: "cloudflare";
      /** Focus session id; the browser calls our /api/video/cloudflare/<id>/* proxy. */
      sessionId: string;
      iceServers: RTCIceServer[];
    }
  | { provider: "livekit"; url: string; token: string; sessionId: string }
  | { provider: "none"; sessionId: string };

export type RemoteParticipant = {
  userId: string;
  displayName: string;
  tracks?: TrackNames | null;
};

export type QualityStats = {
  rttMs?: number;
  packetLossPct?: number;
  outboundKbps?: number;
  inboundKbps?: number;
  relay?: boolean;
  frameHeight?: number;
  framesPerSecond?: number;
};

export type PublishOptions = {
  audio: boolean;
  video: boolean;
  /** Group sessions publish two layers so tiles can pull the small one. */
  simulcast?: boolean;
};

export type VideoClientEvents = {
  /** A remote participant's media changed (tracks added or removed). */
  remote: (userId: string, stream: MediaStream | null) => void;
  connection: (
    state: "connecting" | "connected" | "reconnecting" | "failed" | "closed",
  ) => void;
  quality: (level: "good" | "reduced") => void;
};

export interface VideoClient {
  readonly provider: VideoProviderName;
  join(credentials: JoinCredentials): Promise<void>;
  /** Publishes the local camera/mic. Returns the track names others pull. */
  publishTracks(
    stream: MediaStream,
    options: PublishOptions,
  ): Promise<TrackNames>;
  subscribe(
    participant: RemoteParticipant,
    options?: { lowQuality?: boolean },
  ): Promise<void>;
  unsubscribe(userId: string): Promise<void>;
  /** Muting stops sending audio entirely. */
  setMicrophone(enabled: boolean): Promise<void>;
  /** Pauses receiving remote video, e.g. while the tab is hidden. */
  setRemoteVideo(enabled: boolean): Promise<void>;
  getStats(): Promise<QualityStats>;
  leave(): Promise<void>;
  on<E extends keyof VideoClientEvents>(
    event: E,
    listener: VideoClientEvents[E],
  ): () => void;
}

/** Server side. */
export interface VideoServerProvider {
  readonly name: VideoProviderName;
  createRoom(focusSessionId: string): Promise<{ roomId: string }>;
  issueJoin(input: {
    roomId: string;
    focusSessionId: string;
    userId: string;
    displayName: string;
  }): Promise<JoinCredentials>;
}
