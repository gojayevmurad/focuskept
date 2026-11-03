import { describe, expect, it } from "vitest";
import {
  computeState,
  flowBreak,
  workDuration,
  type TimerEvent,
} from "@/src/features/timer/engine";
import { timerConfigFor } from "@/src/features/timer/configs";

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 2, 9, 0, 0);
const at = (minutes: number) => T0 + minutes * MIN;
const ev = (type: TimerEvent["type"], minutes: number) =>
  ({ type, at: at(minutes) }) as TimerEvent;

describe("pomodoro", () => {
  const config = timerConfigFor("pomodoro");
  it("runs 25 min work then a 5 min break, then waits", () => {
    const events = [ev("start", 0)];
    expect(computeState(config, events, at(10))).toMatchObject({
      phase: "work",
      remaining: 15 * MIN,
      focusedMs: 10 * MIN,
    });
    expect(computeState(config, events, at(25))).toMatchObject({
      phase: "short_break",
      cyclesCompleted: 1,
      focusedMs: 25 * MIN,
    });
    expect(computeState(config, events, at(28))).toMatchObject({
      phase: "short_break",
      remaining: 2 * MIN,
      breakMs: 3 * MIN,
    });
    expect(computeState(config, events, at(31))).toMatchObject({
      phase: "ready",
      focusedMs: 25 * MIN,
      breakMs: 5 * MIN,
      cycle: 2,
    });
  });
  it("never counts time away from the desk (sleep / closed laptop)", () => {
    const later = computeState(config, [ev("start", 0)], at(600));
    expect(later).toMatchObject({
      phase: "ready",
      focusedMs: 25 * MIN,
      breakMs: 5 * MIN,
      cyclesCompleted: 1,
    });
  });
  it("gives a long break after the 4th block", () => {
    const events: TimerEvent[] = [];
    for (let i = 0; i < 4; i++) events.push(ev("start", i * 40));
    const state = computeState(config, events, at(3 * 40 + 25));
    expect(state).toMatchObject({
      phase: "long_break",
      duration: 15 * MIN,
      cyclesCompleted: 4,
    });
    expect(
      computeState(config, [...events, ev("start", 200)], at(226)),
    ).toMatchObject({ phase: "short_break", cyclesCompleted: 5 });
  });
  it("excludes paused time and counts interruptions", () => {
    const events = [ev("start", 0), ev("pause", 10), ev("resume", 18)];
    const paused = computeState(config, events.slice(0, 2), at(15));
    expect(paused).toMatchObject({
      paused: true,
      remaining: 15 * MIN,
      endsAt: null,
      interruptions: 1,
    });
    const resumed = computeState(config, events, at(20));
    expect(resumed).toMatchObject({
      phase: "work",
      remaining: 13 * MIN,
      endsAt: at(33),
      focusedMs: 12 * MIN,
    });
    expect(computeState(config, events, at(33))).toMatchObject({
      phase: "short_break",
      focusedMs: 25 * MIN,
    });
  });
  it("respects configured durations within limits", () => {
    const custom = timerConfigFor("pomodoro", {
      settings: {
        pomodoro: { work: 50, shortBreak: 10, longBreak: 99, cycles: 1 },
      },
    });
    expect(custom).toEqual({
      kind: "cycle",
      work: 50 * MIN,
      shortBreak: 10 * MIN,
      longBreak: 30 * MIN,
      cycles: 2,
    });
  });
  it("is identical after a reload (replaying the same events)", () => {
    const events = [
      ev("start", 0),
      ev("pause", 3),
      ev("resume", 4),
      ev("skip", 12),
    ];
    expect(
      computeState(config, JSON.parse(JSON.stringify(events)), at(14)),
    ).toEqual(computeState(config, events, at(14)));
  });
  it("skipping counts the block only after half of it", () => {
    const early = computeState(
      config,
      [ev("start", 0), ev("skip", 10)],
      at(10),
    );
    expect(early).toMatchObject({
      phase: "short_break",
      cyclesCompleted: 0,
      focusedMs: 10 * MIN,
    });
    const late = computeState(config, [ev("start", 0), ev("skip", 20)], at(20));
    expect(late).toMatchObject({
      phase: "short_break",
      cyclesCompleted: 1,
      focusedMs: 20 * MIN,
    });
    const skipBreak = computeState(
      config,
      [ev("start", 0), ev("skip", 20), ev("skip", 21)],
      at(30),
    );
    expect(skipBreak).toMatchObject({ phase: "ready", breakMs: 1 * MIN });
  });
  it("finishing mid-block books the worked time", () => {
    const done = computeState(
      config,
      [ev("start", 0), ev("finish", 18)],
      at(60),
    );
    expect(done).toMatchObject({
      phase: "finished",
      focusedMs: 18 * MIN,
      cyclesCompleted: 1,
      endedAt: at(18),
      startedAt: at(0),
    });
  });
  it("ignores impossible events", () => {
    const state = computeState(
      config,
      [ev("pause", 1), ev("resume", 2), ev("extend", 3), ev("break", 4)],
      at(5),
    );
    expect(state).toMatchObject({
      phase: "idle",
      focusedMs: 0,
      interruptions: 0,
    });
  });
});

describe("52/17 and Deep work 90", () => {
  it("runs 52 / 17", () => {
    const config = timerConfigFor("52-17");
    expect(computeState(config, [ev("start", 0)], at(52))).toMatchObject({
      phase: "short_break",
      duration: 17 * MIN,
    });
    expect(computeState(config, [ev("start", 0)], at(69))).toMatchObject({
      phase: "ready",
    });
  });
  it("runs 90 / 20", () => {
    const config = timerConfigFor("deep-work-90");
    expect(computeState(config, [ev("start", 0)], at(89))).toMatchObject({
      phase: "work",
      remaining: 1 * MIN,
    });
    expect(computeState(config, [ev("start", 0)], at(90))).toMatchObject({
      phase: "short_break",
      duration: 20 * MIN,
    });
  });
});

describe("custom", () => {
  it("uses a saved preset", () => {
    const config = timerConfigFor("custom", {
      preset: {
        id: "p",
        name: "Long",
        work: 40,
        shortBreak: 8,
        longBreak: 25,
        cycles: 2,
      },
    });
    const events = [ev("start", 0), ev("start", 60)];
    expect(computeState(config, events, at(100))).toMatchObject({
      phase: "long_break",
      duration: 25 * MIN,
    });
  });
});

describe("flowtime", () => {
  const config = timerConfigFor("flowtime");
  it("counts up until the user takes a break of worked ÷ 5 (5–30 min)", () => {
    const working = computeState(config, [ev("start", 0)], at(47));
    expect(working).toMatchObject({
      phase: "work",
      duration: null,
      remaining: null,
      elapsed: 47 * MIN,
    });
    const onBreak = computeState(
      config,
      [ev("start", 0), ev("break", 40)],
      at(41),
    );
    expect(onBreak).toMatchObject({
      phase: "short_break",
      duration: 8 * MIN,
      focusedMs: 40 * MIN,
      cyclesCompleted: 1,
    });
    expect(
      computeState(config, [ev("start", 0), ev("break", 40)], at(48)),
    ).toMatchObject({ phase: "ready" });
  });
  it("clamps the suggested break", () => {
    expect(
      flowBreak(
        { kind: "flow", ratio: 5, minBreak: 5 * MIN, maxBreak: 30 * MIN },
        10 * MIN,
      ),
    ).toBe(5 * MIN);
    expect(
      flowBreak(
        { kind: "flow", ratio: 5, minBreak: 5 * MIN, maxBreak: 30 * MIN },
        200 * MIN,
      ),
    ).toBe(30 * MIN);
  });
});

describe("timeboxing", () => {
  const config = timerConfigFor("timeboxing", { boxMinutes: 30 });
  it("ends the box and logs overtime as overrun", () => {
    expect(computeState(config, [ev("start", 0)], at(30))).toMatchObject({
      phase: "box_ended",
      overrunMs: 0,
      focusedMs: 30 * MIN,
    });
    expect(computeState(config, [ev("start", 0)], at(33))).toMatchObject({
      phase: "box_ended",
      overrunMs: 3 * MIN,
      focusedMs: 33 * MIN,
    });
  });
  it("extends once by 25% of the box", () => {
    const events = [ev("start", 0), ev("extend", 35)];
    const extending = computeState(config, events, at(40));
    expect(extending).toMatchObject({
      phase: "work",
      extended: true,
      remaining: 2.5 * MIN,
      overrunMs: 10 * MIN,
    });
    const ended = computeState(config, [...events, ev("extend", 50)], at(45));
    expect(ended).toMatchObject({
      phase: "box_ended",
      overrunMs: 12.5 * MIN + 2.5 * MIN,
    });
  });
  it("can be extended before the box ends", () => {
    const state = computeState(
      config,
      [ev("start", 0), ev("extend", 20)],
      at(36),
    );
    expect(state).toMatchObject({
      phase: "work",
      remaining: 1.5 * MIN,
      overrunMs: 6 * MIN,
    });
  });
  it("finishes with total overrun", () => {
    const done = computeState(
      config,
      [ev("start", 0), ev("finish", 34)],
      at(90),
    );
    expect(done).toMatchObject({
      phase: "finished",
      focusedMs: 34 * MIN,
      overrunMs: 4 * MIN,
    });
  });
});

describe("waiting for the next block", () => {
  it("shows the next block's planned length, not the time waited", () => {
    expect(workDuration(timerConfigFor("pomodoro"))).toBe(25 * MIN);
    expect(workDuration(timerConfigFor("52-17"))).toBe(52 * MIN);
    expect(workDuration(timerConfigFor("flowtime"))).toBeNull();
  });
});
