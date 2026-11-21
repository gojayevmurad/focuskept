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
