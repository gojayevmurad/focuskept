// SPDX-License-Identifier: AGPL-3.0-only
import type { QualityStats } from "../types";

export type VideoStatsEntry = {
  id: string;
  type: string;
  timestamp: number;
  selected?: boolean;
  nominated?: boolean;
  state?: string;
  selectedCandidatePairId?: string;
  localCandidateId?: string;
  candidateType?: string;
  currentRoundTripTime?: number;
  packetsLost?: number;
  packetsReceived?: number;
  bytesSent?: number;
  bytesReceived?: number;
  kind?: string;
  mediaType?: string;
  frameHeight?: number;
  framesPerSecond?: number;
  qualityLimitationReason?: string;
  availableOutgoingBitrate?: number;
  fractionLost?: number;
};

export function summarizeStats(
  report: Iterable<VideoStatsEntry>,
  previous?: Iterable<VideoStatsEntry>,
): QualityStats {
  const entries = Array.from(report);
  const before = new Map(
    Array.from(previous ?? [], (entry) => [entry.id, entry]),
  );
  const selectedId = entries.find(
    (entry) => entry.type === "transport" && entry.selectedCandidatePairId,
  )?.selectedCandidatePairId;
  const pair =
    entries.find(
      (entry) => entry.type === "candidate-pair" && entry.id === selectedId,
    ) ??
    entries.find(
      (entry) =>
        entry.type === "candidate-pair" &&
        (entry.selected || (entry.nominated && entry.state === "succeeded")),
    );
  const result: QualityStats = {};
  if (pair) {
    if (pair.currentRoundTripTime !== undefined)
      result.rttMs = pair.currentRoundTripTime * 1000;
    const candidate = entries.find(
      (entry) => entry.id === pair.localCandidateId,
    );
    if (candidate) result.relay = candidate.candidateType === "relay";
  }
  let lost = 0,
    received = 0;
  for (const entry of entries) {
    if (entry.type === "inbound-rtp") {
      lost += Math.max(0, entry.packetsLost ?? 0);
      received += Math.max(0, entry.packetsReceived ?? 0);
    }
    if (
      entry.type === "outbound-rtp" &&
      (entry.kind ?? entry.mediaType) === "video"
    ) {
      if (entry.frameHeight !== undefined)
        result.frameHeight = entry.frameHeight;
      if (entry.framesPerSecond !== undefined)
        result.framesPerSecond = entry.framesPerSecond;
    }
    const old = before.get(entry.id);
    if (!old || entry.timestamp <= old.timestamp) continue;
    const field =
      entry.type === "outbound-rtp"
        ? "bytesSent"
        : entry.type === "inbound-rtp"
          ? "bytesReceived"
          : undefined;
    if (!field || entry[field] === undefined || old[field] === undefined)
      continue;
    const delta = entry[field] - old[field];
    if (delta < 0) continue;
    const key = field === "bytesSent" ? "outboundKbps" : "inboundKbps";
    result[key] =
      (result[key] ?? 0) + (delta * 8) / (entry.timestamp - old.timestamp);
  }
  if (lost + received > 0)
    result.packetLossPct = (lost * 100) / (lost + received);
  return result;
}
