// SPDX-License-Identifier: AGPL-3.0-only
import type { TrackNames } from "../types";

export function canPull(
  callerId: string,
  focusSessionId: string,
  target:
    | {
        userId: string;
        sessionId: string;
        videoSessionId: string | null;
        tracks: TrackNames | null;
      }
    | undefined,
  trackName: string,
): boolean {
  return Boolean(
    target &&
    target.userId !== callerId &&
    target.sessionId === focusSessionId &&
    target.videoSessionId &&
    trackName &&
    (target.tracks?.audio === trackName || target.tracks?.video === trackName),
  );
}

export function canAnnounce(userId: string, tracks: TrackNames): boolean {
  const hasAny = Boolean(tracks.audio || tracks.video);
  if (!hasAny) return false;
  if (
    tracks.audio &&
    (!tracks.audio.startsWith(`${userId}-audio-`) ||
      tracks.audio.length <= `${userId}-audio-`.length)
  ) {
    return false;
  }
  if (
    tracks.video &&
    (!tracks.video.startsWith(`${userId}-video-`) ||
      tracks.video.length <= `${userId}-video-`.length)
  ) {
    return false;
  }
  return true;
}
