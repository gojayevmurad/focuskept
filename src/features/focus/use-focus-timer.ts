"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeState,
  type Phase,
  type TimerEvent,
  type TimerState,
} from "@/src/features/timer/engine";
import { saveActive, type ActiveSession } from "./active-session";
import { playChime } from "./audio";
import { notifyWhenHidden } from "./notify";

type Options = {
  chime: boolean;
  chimeVolume: number;
  /** Already-translated strings for a phase change. */
  describePhase: (
    phase: Phase,
    state: TimerState,
  ) => { title: string; body: string };
  onPhaseChange?: (phase: Phase, previous: Phase) => void;
};

/**
 * Drives a persisted session: replays events through the pure engine on every
 * tick. Ticks come from a dedicated worker (not throttled in background tabs)
 * plus a precise alarm at the next phase end.
 */
export function useFocusTimer(
  session: ActiveSession,
  setSession: (session: ActiveSession) => void,
  options: Options,
) {
  const [now, setNow] = useState(() => Date.now());
  const state = useMemo(
    () => computeState(session.config, session.events, now),
    [session.config, session.events, now],
  );
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const dispatch = useCallback(
    (type: TimerEvent["type"]) => {
      const at = Date.now();
      const next = {
        ...session,
        events: [...session.events, { type, at } as TimerEvent],
      };
      saveActive(next);
      setSession(next);
      setNow(at);
    },
    [session, setSession],
  );

  // Ticker worker + alarm at the exact end of the current phase.
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./ticker.worker.ts", import.meta.url));
      worker.onmessage = () => setNow(Date.now());
      worker.postMessage({ type: "start" });
      workerRef.current = worker;
    } catch {
      // Fallback: visibility-aware main-thread ticking.
    }
    const fallback = worker
      ? undefined
      : setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      worker?.postMessage({ type: "stop" });
      worker?.terminate();
      workerRef.current = null;
      if (fallback) clearInterval(fallback);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
  useEffect(() => {
    workerRef.current?.postMessage({
      type: "alarm",
      at: state.endsAt ?? undefined,
    });
  }, [state.endsAt]);

  // Phase changes: chime, background notification, callback.
  const previous = useRef<Phase>(state.phase);
  useEffect(() => {
    const before = previous.current;
    if (before === state.phase) return;
    previous.current = state.phase;
    const { chime, chimeVolume, describePhase, onPhaseChange } =
      optionsRef.current;
    const automatic = state.phase !== "work" || before === "box_ended";
    if (chime && automatic && state.phase !== "finished")
      playChime(chimeVolume, state.phase === "work" ? "focus" : "break");
    if (state.phase !== "finished") {
      const { title, body } = describePhase(state.phase, state);
      void notifyWhenHidden(title, body);
    }
    onPhaseChange?.(state.phase, before);
  }, [state]);

  return { state, dispatch, now };
}
