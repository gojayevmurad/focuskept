// SPDX-License-Identifier: AGPL-3.0-only
export type Topic = `user:${string}` | `session:${string}`;

export type RealtimeEvent =
  // user topics
  | "booking.matched"
  | "booking.partner_changed"
  | "booking.fallback"
  | "booking.updated"
  | "match.found"
  // session topics
  | "session.presence"
  | "session.tracks"
  | "session.goal"
  | "session.outcome"
  | "session.timer"
  | "session.ended"
  | "ping";

export type RealtimeMessage = {
  topic: Topic;
  event: RealtimeEvent;
  data: Record<string, unknown>;
  at: number;
};
