import { describe, expect, it } from "vitest";
import {
  summarizeStats,
  type VideoStatsEntry,
} from "@/src/lib/video/client/stats";

const entry = (
  id: string,
  type: string,
  extra: Partial<VideoStatsEntry> = {},
): VideoStatsEntry => ({ id, type, timestamp: 2000, ...extra });

describe("summarizeStats", () => {
  it("uses the selected pair and its local candidate for RTT and relay", () => {
    expect(
      summarizeStats([
        entry("transport", "transport", {
          selectedCandidatePairId: "selected",
        }),
        entry("other", "candidate-pair", {
          nominated: true,
          state: "succeeded",
          currentRoundTripTime: 1,
        }),
        entry("selected", "candidate-pair", {
          currentRoundTripTime: 0.08,
          localCandidateId: "local",
        }),
        entry("local", "local-candidate", { candidateType: "relay" }),
      ]),
    ).toEqual({ rttMs: 80, relay: true });
  });

  it("falls back to a nominated successful pair and detects direct traffic", () => {
    expect(
      summarizeStats([
        entry("pair", "candidate-pair", {
          nominated: true,
          state: "succeeded",
          localCandidateId: "local",
        }),
        entry("local", "local-candidate", { candidateType: "host" }),
      ]),
    ).toEqual({ relay: false });
  });

  it("aggregates inbound loss and ignores remote inbound counters", () => {
    expect(
      summarizeStats([
        entry("audio", "inbound-rtp", { packetsLost: 5, packetsReceived: 45 }),
        entry("video", "inbound-rtp", { packetsLost: 5, packetsReceived: 45 }),
        entry("remote", "remote-inbound-rtp", {
          packetsLost: 100,
          packetsReceived: 0,
        }),
      ]).packetLossPct,
    ).toBe(10);
  });

  it("computes kbps from individual byte and millisecond deltas", () => {
    const before = [
      entry("out", "outbound-rtp", { timestamp: 1000, bytesSent: 1000 }),
      entry("in", "inbound-rtp", { timestamp: 1000, bytesReceived: 2000 }),
    ];
    expect(
      summarizeStats(
        [
          entry("out", "outbound-rtp", {
            bytesSent: 76000,
            kind: "video",
            frameHeight: 480,
            framesPerSecond: 24,
          }),
          entry("in", "inbound-rtp", { bytesReceived: 39500 }),
        ],
        before,
      ),
    ).toEqual({
      outboundKbps: 600,
      inboundKbps: 300,
      frameHeight: 480,
      framesPerSecond: 24,
    });
  });

  it("does not fabricate rates before a baseline or after counter reset", () => {
    expect(summarizeStats([])).toEqual({});
    expect(
      summarizeStats([entry("a", "outbound-rtp", { bytesSent: 100 })]),
    ).toEqual({});
    expect(
      summarizeStats(
        [entry("a", "outbound-rtp", { bytesSent: 100 })],
        [entry("a", "outbound-rtp", { timestamp: 1000, bytesSent: 200 })],
      ),
    ).toEqual({});
  });
});
