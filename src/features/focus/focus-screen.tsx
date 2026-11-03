"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Coffee, Expand, Keyboard, Shrink, SkipForward } from "lucide-react";
import {
  computeState,
  workDuration,
  type Phase,
  type TimerState,
} from "@/src/features/timer/engine";
import type { SoundSettings } from "@/src/lib/db/json-types";
import { Dialog } from "@/src/components/ui/dialog";
import type { ActiveSession } from "./active-session";
import { useFocusTimer } from "./use-focus-timer";
import { formatClock, formatMinutes } from "./format";
import { BackgroundSound, unlockAudio } from "./audio";
import { requestNotificationPermission } from "./notify";
import { SoundMenu } from "./sound-menu";

const TIP_COUNT = 6;

export type BoxDecision = "done" | "later";

export function FocusScreen({
  session,
  onSessionChange,
  onFinished,
  sound,
  onSoundChange,
  techniqueName,
}: {
  session: ActiveSession;
  onSessionChange: (session: ActiveSession) => void;
  onFinished: (state: TimerState, decision?: BoxDecision) => void;
  sound: SoundSettings;
  onSoundChange: (sound: SoundSettings) => void;
  techniqueName: string;
}) {
  const t = useTranslations("timer");
  const home = useTranslations("home");
  const [noteDraft, setNoteDraft] = useState("");
  const locale = useLocale();
  const [announcement, setAnnouncement] = useState("");
  const [tip, setTip] = useState(1);
  const [help, setHelp] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const background = useRef<BackgroundSound | null>(null);

  const phaseLabel = useCallback((phase: Phase) => t(`phase.${phase}`), [t]);

  const { state, dispatch } = useFocusTimer(session, onSessionChange, {
    chime: sound.chime,
    chimeVolume: sound.chimeVolume,
    describePhase: (phase, s) => {
      if (phase === "short_break" || phase === "long_break")
        return {
          title: t("notify.breakTitle"),
          body: t("notify.breakBody", {
            duration: formatMinutes((s.duration ?? 0) / 60000, locale),
          }),
        };
      if (phase === "box_ended")
        return { title: t("notify.boxTitle"), body: t("notify.boxBody") };
      if (phase === "ready")
        return { title: t("notify.readyTitle"), body: t("notify.readyBody") };
      return {
        title: t("notify.focusTitle"),
        body: session.goal || techniqueName,
      };
    },
    onPhaseChange: (phase) => {
      setAnnouncement(t("announce", { phase: phaseLabel(phase) }));
      if (phase === "short_break" || phase === "long_break")
        setTip((n) => (n % TIP_COUNT) + 1);
    },
  });

  const finishedRef = useRef(false);
  useEffect(() => {
    if (state.phase === "finished" && !finishedRef.current) {
      finishedRef.current = true;
      onFinished(state);
    }
  }, [state, onFinished]);

  // Background sound follows settings; it pauses with the timer.
  useEffect(() => {
    background.current ??= new BackgroundSound();
    const playing =
      !state.paused && (state.phase === "work" || state.phase === "box_ended");
    if (playing)
      background.current.play(sound.background, sound.backgroundVolume);
    else background.current.stop();
  }, [sound.background, sound.backgroundVolume, state.paused, state.phase]);
  useEffect(() => () => background.current?.stop(), []);

  // Tab title shows remaining time and phase.
  useEffect(() => {
    const original = document.title;
    return () => {
      document.title = original;
    };
  }, []);
  const counting = state.duration === null;
  // After a break the timer waits; counting that wait up grew to hours when a
  // tab was left open, so "ready" shows the next block's length instead.
  const shown =
    state.phase === "ready"
      ? (workDuration(session.config) ?? 0)
      : counting
        ? state.elapsed
        : (state.remaining ?? 0);
  const digits = formatClock(shown, locale);
  useEffect(() => {
    if (state.phase === "idle" || state.phase === "finished") return;
    document.title = `${state.paused ? "⏸ " : ""}${digits} · ${phaseLabel(state.phase)}`;
  }, [digits, state.phase, state.paused, phaseLabel]);

  const running =
    !state.paused && (state.phase === "work" || state.phase === "box_ended");

  // Focus mode: header, trail and tab bar step back while a block runs.
  useEffect(() => {
    if (!running) return;
    document.documentElement.dataset.focusing = "";
    return () => {
      delete document.documentElement.dataset.focusing;
    };
  }, [running]);

  // Everything but the timer fades after 3 s without input while focusing.
  useEffect(() => {
    if (!running) return;
    let timer = setTimeout(() => setIdle(true), 3000);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 3000);
    };
    const events = [
      "mousemove",
      "pointerdown",
      "keydown",
      "touchstart",
    ] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [running]);

  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement)
      await document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen)
      await el.requestFullscreen().catch(() => setFullscreen((f) => !f));
    else setFullscreen((f) => !f);
  }, []);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const primary = useCallback(() => {
    unlockAudio();
    if (state.phase === "idle" || state.phase === "ready") {
      void requestNotificationPermission();
      dispatch("start");
    } else if (state.paused) dispatch("resume");
    else if (state.phase !== "finished") dispatch("pause");
  }, [dispatch, state.paused, state.phase]);

  // Keyboard shortcuts: Space, S, F, Esc, ?
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]"))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") {
        e.preventDefault();
        primary();
      } else if (e.key.toLowerCase() === "s") dispatch("skip");
      else if (e.key.toLowerCase() === "f") void toggleFullscreen();
      else if (e.key === "Escape" && fullscreen && !document.fullscreenElement)
        setFullscreen(false);
      else if (e.key === "?") setHelp(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary, dispatch, toggleFullscreen, fullscreen]);

  const isBreak = state.phase === "short_break" || state.phase === "long_break";
  const between = isBreak || state.phase === "ready";
  const progress =
    state.duration && state.duration > 0
      ? Math.min(1, state.elapsed / state.duration)
      : state.phase === "work" || state.phase === "box_ended"
        ? Math.min(1, state.elapsed / 5_400_000)
        : 0;
  const config = session.config;
  const total = config.kind === "cycle" ? config.cycles : 0;
  const current =
    config.kind === "cycle" ? ((state.cycle - 1) % config.cycles) + 1 : 0;
  // During a break the engine already counts the next block.
  const finishedBlock =
    config.kind === "cycle"
      ? ((state.cycle - 2 + config.cycles) % config.cycles) + 1
      : 0;
  const extendMinutes =
    config.kind === "box"
      ? Math.round((config.box * config.extendRatio) / 60000)
      : 0;
  const learning = session.learning;
  const title =
    learning?.topic ||
    session.task?.title ||
    session.goal ||
    (session.mode === "learning" ? home("newTopic") : home("focusFallback"));
  const label = [
    session.mode === "learning" ? home("learn") : home("work"),
    techniqueName,
    total > 1 && state.phase !== "idle"
      ? home("runBlock", { current, total })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const previousNotes = (learning?.notes.notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  /** Appends the break note to the session's learning notes. */
  function withNote(next: ActiveSession): ActiveSession {
    const note = noteDraft.trim();
    if (!note || !next.learning) return next;
    const existing = next.learning.notes.notes?.trim();
    return {
      ...next,
      learning: {
        ...next.learning,
        notes: {
          ...next.learning.notes,
          notes: (existing ? `${existing}\n${note}` : note).slice(0, 20_000),
        },
      },
    };
  }

  function nextBlock() {
    unlockAudio();
    const at = Date.now();
    const events = [...session.events];
    if (isBreak) events.push({ type: "skip", at });
    events.push({ type: "start", at });
    onSessionChange(withNote({ ...session, events }));
    setNoteDraft("");
  }

  function endSession() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const at = Date.now();
    const next = withNote({
      ...session,
      events: [...session.events, { type: "finish" as const, at }],
    });
    onSessionChange(next);
    onFinished(computeState(next.config, next.events, at));
  }

  return (
    <div
      ref={rootRef}
      className={[
        "focus-stage",
        fullscreen ? "is-fullscreen" : "",
        idle && running ? "is-idle" : "",
      ].join(" ")}
      data-phase={state.phase}
    >
      <p className="sr-only" aria-live="polite" role="status">
        {announcement}
      </p>

      {between ? (
        <section className="break-view" aria-labelledby="break-title">
          <p id="break-title" className="eyebrow">
            {state.phase === "ready"
              ? home("breakOver")
              : home("breakTitle", { current: finishedBlock, total })}
          </p>
          <div
            className="break-digits ltr-island"
            role="timer"
            aria-label={t("timerLabel")}
          >
            {digits}
          </div>
          {learning ? (
            <div className="break-note">
              <label htmlFor="break-note">{home("breakNote")}</label>
              <p className="hint">{home("breakNoteHint")}</p>
              {previousNotes.map((line, i) => (
                <p key={i} className="break-note-line" dir="auto">
                  {line}
                </p>
              ))}
              <textarea
                id="break-note"
                className="note-field"
                dir="auto"
                rows={3}
                maxLength={2000}
                value={noteDraft}
                placeholder={home("breakNotePlaceholder")}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
            </div>
          ) : (
            <p className="break-tip">{t(`tips.${tip}` as "tips.1")}</p>
          )}
          <div className="break-actions">
            <button className="btn btn-primary btn-lg" onClick={nextBlock}>
              {home("nextBlock", {
                current: (finishedBlock % Math.max(1, total)) + 1,
                total,
              })}
            </button>
            <button className="btn btn-ghost" onClick={endSession}>
              {home("endSession")}
            </button>
          </div>
        </section>
      ) : state.phase === "box_ended" ? (
        <section className="break-view">
          <p className="eyebrow">{t("phase.box_ended")}</p>
          <div className="break-digits ltr-island" role="timer">
            +{digits}
          </div>
          <h2 className="text-2xl">{t("box.title")}</h2>
          <div className="break-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => onFinishedWith("done")}
            >
              {t("box.done")}
            </button>
            <button
              className="btn btn-secondary btn-lg"
              disabled={state.extended}
              onClick={() => dispatch("extend")}
            >
              {t("box.extend", {
                duration: formatMinutes(extendMinutes, locale),
              })}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => onFinishedWith("later")}
            >
              {t("box.later")}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="run-card">
            <div
              className="run-fill"
              aria-hidden="true"
              style={{ blockSize: `${(progress * 100).toFixed(2)}%` }}
            />
            <div className="run-body">
              <p className="run-label">{label}</p>
              <h1 className="run-title" dir="auto">
                {title}
              </h1>
              <div className="run-spacer" />
              <div
                className="run-digits ltr-island"
                role="timer"
                aria-label={t("timerLabel")}
              >
                {digits}
              </div>
              <p className="run-phase">
                {state.paused
                  ? t("paused")
                  : config.kind === "flow"
                    ? t("flowHint")
                    : home("fillHint")}
              </p>
            </div>
          </section>
          <div className="run-controls">
            <button className="btn btn-inverse btn-lg" onClick={primary}>
              {state.phase === "idle"
                ? t("controls.start")
                : state.paused
                  ? t("controls.resume")
                  : t("controls.pause")}
            </button>
            {config.kind === "flow" && state.phase === "work" && (
              <button
                className="btn btn-secondary btn-lg"
                onClick={() => dispatch("break")}
              >
                <Coffee size={18} aria-hidden="true" />
                {t("controls.takeBreak")}
              </button>
            )}
            {state.phase !== "idle" && (
              <button className="btn btn-secondary btn-lg" onClick={endSession}>
                {t("controls.finish")}
              </button>
            )}
          </div>
        </>
      )}

      <div className="focus-chrome run-tools">
        {state.phase === "work" && config.kind === "cycle" && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch("skip")}
          >
            <SkipForward size={15} className="rtl-flip" aria-hidden="true" />
            {t("controls.skip")}
          </button>
        )}
        <SoundMenu
          value={sound}
          onChange={onSoundChange}
          live={
            !state.paused &&
            (state.phase === "work" || state.phase === "box_ended")
          }
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => void toggleFullscreen()}
          aria-pressed={fullscreen}
        >
          {fullscreen ? (
            <Shrink size={15} aria-hidden="true" />
          ) : (
            <Expand size={15} aria-hidden="true" />
          )}
          {fullscreen ? t("controls.exitFullscreen") : t("controls.fullscreen")}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setHelp(true)}>
          <Keyboard size={15} aria-hidden="true" />
          {t("controls.shortcuts")}
        </button>
      </div>

      <Dialog
        open={help}
        onClose={() => setHelp(false)}
        title={t("shortcuts.title")}
        labelledBy="shortcuts-title"
      >
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 small">
          {(
            [
              [t("shortcuts.keySpace"), "space"],
              ["S", "skip"],
              ["F", "fullscreen"],
              [t("shortcuts.keyEsc"), "exit"],
              ["?", "help"],
            ] as const
          ).map(([key, label]) => (
            <div key={label} className="contents">
              <dt>
                <kbd className="kbd">{key}</kbd>
              </dt>
              <dd>{t(`shortcuts.${label}`)}</dd>
            </div>
          ))}
        </dl>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={() => setHelp(false)}>
            {t("controls.close")}
          </button>
        </div>
      </Dialog>
    </div>
  );

  function onFinishedWith(decision: BoxDecision) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const at = Date.now();
    const next = {
      ...session,
      events: [...session.events, { type: "finish" as const, at }],
    };
    onSessionChange(next);
    onFinished(computeState(next.config, next.events, at), decision);
  }
}
