// Pure, timestamp-based timer engine: state = f(config, events, now).
//
// Nothing here counts intervals. Every value is derived from event
// timestamps, so the timer stays exact when a tab sleeps, the laptop sleeps
// or the page reloads (events are persisted and replayed).
//
// Phases advance automatically from work into a break. After a break the
// timer waits in `ready` until the user starts the next block, so time spent
// away from the desk is never counted as focus.

export type CycleConfig = {
  kind: "cycle";
  /** All durations in milliseconds. */
  work: number;
  shortBreak: number;
  longBreak: number;
  /** Work blocks before a long break. */
  cycles: number;
};
export type FlowConfig = {
  kind: "flow";
  /** Suggested break = worked / ratio, clamped to [minBreak, maxBreak] ms. */
  ratio: number;
  minBreak: number;
  maxBreak: number;
};
export type BoxConfig = {
  kind: "box";
  /** The box in milliseconds. */
  box: number;
  /** One extension of box × extendRatio is allowed. */
  extendRatio: number;
};
export type TimerConfig = CycleConfig | FlowConfig | BoxConfig;

export type TimerEvent =
  | { type: "start"; at: number }
  | { type: "pause"; at: number }
  | { type: "resume"; at: number }
  | { type: "skip"; at: number }
  | { type: "break"; at: number }
  | { type: "extend"; at: number }
  | { type: "finish"; at: number };

export type Phase =
  | "idle"
  | "work"
  | "short_break"
  | "long_break"
  | "ready"
  | "box_ended"
  | "finished";

export type TimerState = {
  phase: Phase;
  paused: boolean;
  /** Active (non-paused) time spent in the current phase, ms. */
  elapsed: number;
  /** Planned length of the current phase, ms; null when counting up. */
  duration: number | null;
  /** Remaining ms in a timed phase (never negative); null when counting up. */
  remaining: number | null;
  /** Absolute time the current phase ends if nothing changes (null if paused/count-up). */
  endsAt: number | null;
  /** 1-based number of the current (or next) work block. */
  cycle: number;
  cyclesCompleted: number;
  focusedMs: number;
  breakMs: number;
  /** Timeboxing: time worked beyond the original box (extension + overtime). */
  overrunMs: number;
  /** Pauses taken during work phases. */
  interruptions: number;
  /** Timeboxing: the single extension has been used. */
  extended: boolean;
  startedAt: number | null;
  endedAt: number | null;
};

/** A work block counts as completed once at least half of it was done. */
const COMPLETION_SHARE = 0.5;

type Internal = TimerState & {
  /** Start of the current phase plus all pauses inside it ("virtual start"). */
  anchor: number;
  pausedAt: number | null;
  /** Timeboxing: the current work phase is the extension after the box ended. */
  inExtension: boolean;
};

function initial(): Internal {
  return {
    phase: "idle",
    paused: false,
    elapsed: 0,
    duration: null,
    remaining: null,
    endsAt: null,
    cycle: 1,
    cyclesCompleted: 0,
    focusedMs: 0,
    breakMs: 0,
    overrunMs: 0,
    interruptions: 0,
    extended: false,
    startedAt: null,
    endedAt: null,
    anchor: 0,
    pausedAt: null,
    inExtension: false,
  };
}

/** Planned length of a work block, ms; null when it counts up (flow). */
export function workDuration(config: TimerConfig): number | null {
  if (config.kind === "cycle") return config.work;
  if (config.kind === "box") return config.box;
  return null;
}

/** Part of a work phase's active time that lies beyond the original box. */
function overrunOf(config: TimerConfig, s: Internal, active: number) {
  if (config.kind !== "box") return 0;
  return s.inExtension ? active : Math.max(0, active - config.box);
}

/** Time active in the phase at `at` (pauses excluded). */
function activeAt(s: Internal, at: number) {
  return Math.max(0, (s.pausedAt ?? at) - s.anchor);
}

function enter(s: Internal, phase: Phase, at: number, duration: number | null) {
  s.phase = phase;
  s.anchor = at;
  s.duration = duration;
  s.pausedAt = s.paused ? at : null;
}

/** Books the active time of the phase that is ending. */
function closePhase(config: TimerConfig, s: Internal, at: number) {
  const active =
    s.duration === null
      ? activeAt(s, at)
      : Math.min(activeAt(s, at), s.duration);
  if (s.phase === "work") {
    s.focusedMs += active;
    s.overrunMs += overrunOf(config, s, active);
  } else if (s.phase === "box_ended") {
    s.focusedMs += active;
    s.overrunMs += active;
  } else if (s.phase === "short_break" || s.phase === "long_break") {
    s.breakMs += active;
  }
  return active;
}

function startBreak(
  config: TimerConfig,
  s: Internal,
  at: number,
  worked: number,
) {
  if (config.kind === "cycle") {
    const long =
      s.cyclesCompleted > 0 && s.cyclesCompleted % config.cycles === 0;
    enter(
      s,
      long ? "long_break" : "short_break",
      at,
      long ? config.longBreak : config.shortBreak,
    );
  } else if (config.kind === "flow") {
    enter(s, "short_break", at, flowBreak(config, worked));
  }
}

export function flowBreak(config: FlowConfig, workedMs: number) {
  return Math.min(
    config.maxBreak,
    Math.max(config.minBreak, Math.round(workedMs / config.ratio)),
  );
}

function completeWork(config: TimerConfig, s: Internal, at: number) {
  const planned = s.duration;
  const worked = closePhase(config, s, at);
  if (planned === null || worked >= planned * COMPLETION_SHARE)
    s.cyclesCompleted += 1;
  s.cycle = s.cyclesCompleted + 1;
  return worked;
}

/** Applies automatic transitions that happen by `until` (no user input). */
function advance(config: TimerConfig, s: Internal, until: number) {
  for (let guard = 0; guard < 10000; guard++) {
    if (s.paused || s.duration === null) return;
    if (!["work", "short_break", "long_break"].includes(s.phase)) return;
    const end = s.anchor + s.duration;
    if (end > until) return;
    if (s.phase === "work") {
      if (config.kind === "box") {
        closePhase(config, s, end);
        s.inExtension = false;
        enter(s, "box_ended", end, null);
        return;
      }
      const worked = completeWork(config, s, end);
      startBreak(config, s, end, worked);
    } else {
      closePhase(config, s, end);
      enter(s, "ready", end, null);
    }
  }
}

function apply(config: TimerConfig, s: Internal, event: TimerEvent) {
  const at = event.at;
  if (s.phase === "finished") return;
  switch (event.type) {
    case "start":
      if (s.phase === "idle" || s.phase === "ready") {
        if (s.startedAt === null) s.startedAt = at;
        s.paused = false;
        enter(s, "work", at, workDuration(config));
      }
      return;
    case "pause":
      if (s.paused || s.phase === "idle" || s.phase === "ready") return;
      s.paused = true;
      s.pausedAt = at;
      if (s.phase === "work" || s.phase === "box_ended") s.interruptions += 1;
      return;
    case "resume":
      if (!s.paused) return;
      s.anchor += at - (s.pausedAt ?? at);
      s.paused = false;
      s.pausedAt = null;
      return;
    case "skip":
      if (s.phase === "work") {
        if (config.kind === "box") {
          closePhase(config, s, at);
          s.inExtension = false;
          enter(s, "box_ended", at, null);
        } else {
          const worked = completeWork(config, s, at);
          startBreak(config, s, at, worked);
        }
      } else if (s.phase === "short_break" || s.phase === "long_break") {
        closePhase(config, s, at);
        enter(s, "ready", at, null);
      } else if (s.phase === "ready" || s.phase === "idle") {
        apply(config, s, { type: "start", at });
      }
      return;
    case "break":
      if (s.phase === "work" && config.kind === "flow") {
        const worked = completeWork(config, s, at);
        startBreak(config, s, at, worked);
      }
      return;
    case "extend": {
      // Timeboxing allows one extension of box × extendRatio.
      if (config.kind !== "box" || s.extended) return;
      const extra = Math.round(config.box * config.extendRatio);
      if (s.phase === "work") {
        s.extended = true;
        s.duration = (s.duration ?? 0) + extra;
      } else if (s.phase === "box_ended") {
        closePhase(config, s, at);
        s.extended = true;
        s.inExtension = true;
        enter(s, "work", at, extra);
      }
      return;
    }
    case "finish":
      if (s.phase === "work" && config.kind !== "box")
        completeWork(config, s, at);
      else closePhase(config, s, at);
      s.phase = "finished";
      s.paused = false;
      s.pausedAt = null;
      s.duration = null;
      s.endedAt = at;
      return;
  }
}

/** Derives the full timer state at `now` from the configuration and events. */
export function computeState(
  config: TimerConfig,
  events: readonly TimerEvent[],
  now: number,
): TimerState {
  const s = initial();
  for (const event of events) {
    advance(config, s, event.at);
    apply(config, s, event);
  }
  advance(config, s, now);
  const elapsed =
    s.phase === "finished" || s.phase === "idle" ? 0 : activeAt(s, now);
  const remaining =
    s.duration === null ? null : Math.max(0, s.duration - elapsed);
  const live = s.phase === "work" || s.phase === "box_ended";
  const liveBreak = s.phase === "short_break" || s.phase === "long_break";
  // Include the running phase in the totals so the UI shows them live.
  let focusedMs = s.focusedMs;
  let breakMs = s.breakMs;
  let overrunMs = s.overrunMs;
  if (live) {
    const active =
      s.duration === null ? elapsed : Math.min(elapsed, s.duration);
    focusedMs += active;
    overrunMs +=
      s.phase === "box_ended" ? active : overrunOf(config, s, active);
  }
  if (liveBreak)
    breakMs += s.duration === null ? elapsed : Math.min(elapsed, s.duration);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { anchor, pausedAt, inExtension, ...rest } = s;
  return {
    ...rest,
    elapsed,
    remaining,
    endsAt:
      s.paused || s.duration === null || s.phase === "finished"
        ? null
        : s.anchor + s.duration,
    focusedMs,
    breakMs,
    overrunMs,
  };
}

/** True when an event would change the state (used to disable buttons). */
export function canApply(
  config: TimerConfig,
  events: readonly TimerEvent[],
  event: TimerEvent,
) {
  const before = computeState(config, events, event.at);
  const after = computeState(config, [...events, event], event.at);
  return JSON.stringify(before) !== JSON.stringify(after);
}
