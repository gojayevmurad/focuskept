"use client";
import { useEffect, useRef } from "react";
import type { RealtimeEvent, RealtimeMessage } from "./types";

const EVENTS: RealtimeEvent[] = [
  "booking.matched",
  "booking.partner_changed",
  "booking.fallback",
  "booking.updated",
  "session.presence",
  "session.tracks",
  "session.goal",
  "session.outcome",
  "session.timer",
  "session.ended",
];

/** Subscribes to the user's realtime stream (plus one session, if given). */
export function useRealtime(
  onMessage: (message: RealtimeMessage) => void,
  options: { sessionId?: string; onReconnect?: () => void } = {},
) {
  const handler = useRef(onMessage);
  const reconnect = useRef(options.onReconnect);
  useEffect(() => {
    handler.current = onMessage;
    reconnect.current = options.onReconnect;
  });
  useEffect(() => {
    const url = options.sessionId
      ? `/api/realtime?session=${encodeURIComponent(options.sessionId)}`
      : "/api/realtime";
    const source = new EventSource(url);
    let opened = false;
    source.onopen = () => {
      // After a drop, state may have changed while we were away.
      if (opened) reconnect.current?.();
      opened = true;
    };
    const listener = (event: MessageEvent<string>) => {
      try {
        handler.current(JSON.parse(event.data) as RealtimeMessage);
      } catch {}
    };
    for (const name of EVENTS) source.addEventListener(name, listener);
    return () => source.close();
  }, [options.sessionId]);
}
