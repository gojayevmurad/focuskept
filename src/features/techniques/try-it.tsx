"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Flame,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  X,
} from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { computeState, type TimerEvent } from "@/src/features/timer/engine";
import { timerConfigFor } from "@/src/features/timer/configs";
import { formatClock, formatMinutes } from "@/src/features/focus/format";
import { playChime, unlockAudio } from "@/src/features/focus/audio";
import type { PlanningTechnique, TimeTechnique } from "./slugs";

/** A working, throwaway timer for technique pages (nothing is saved). */
export function TryTimer({ technique }: { technique: TimeTechnique }) {
  const t = useTranslations("tryIt");
  const timer = useTranslations("timer");
  const locale = useLocale();
  const [box, setBox] = useState(25);
  const config = useMemo(
    () => timerConfigFor(technique, { boxMinutes: box }),
    [technique, box],
  );
  const [events, setEvents] = useState<TimerEvent[]>([]);
  const [now, setNow] = useState(0);
  const running = events.length > 0;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);
  const state = computeState(config, events, now || (events.at(-1)?.at ?? 0));
  const previous = useRef(state.phase);
  useEffect(() => {
    if (previous.current !== state.phase && state.phase !== "idle")
      playChime(0.5, state.phase === "work" ? "focus" : "break");
    previous.current = state.phase;
  }, [state.phase]);
  const push = (type: TimerEvent["type"]) => {
    const at = Date.now();
    setEvents((list) => [...list, { type, at }]);
    setNow(at);
  };
  const shown =
    state.duration === null
      ? state.elapsed
      : (state.remaining ??
        (config.kind === "cycle"
          ? config.work
          : config.kind === "box"
            ? config.box
            : 0));
  const idle = state.phase === "idle";
  return (
    <div className="card stack items-center text-center" style={{ gap: 12 }}>
      <span className="phase-label">
        {state.paused ? timer("paused") : timer(`phase.${state.phase}`)}
      </span>
      <span
        className="timer-digits ltr-island"
        style={{ fontSize: "clamp(44px, 12vw, 64px)" }}
        role="timer"
        aria-label={timer("timerLabel")}
      >
        {formatClock(
          idle
            ? config.kind === "cycle"
              ? config.work
              : config.kind === "box"
                ? config.box
                : 0
            : shown,
          locale,
        )}
      </span>
      {technique === "timeboxing" && idle && (
        <label className="field" style={{ maxWidth: 200 }}>
          <span className="label tiny">{t("box")}</span>
          <input
            className="input tabular"
            type="number"
            min={5}
            max={240}
            value={box}
            onChange={(e) =>
              setBox(Math.min(240, Math.max(5, Number(e.target.value) || 5)))
            }
          />
        </label>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {idle || state.phase === "ready" ? (
          <button
            className="btn btn-primary"
            onClick={() => {
              unlockAudio();
              push("start");
            }}
          >
            <Play size={16} aria-hidden="true" />
            {idle ? timer("controls.start") : timer("controls.startNext")}
          </button>
        ) : state.phase === "box_ended" ? (
          <button
            className="btn btn-primary"
            disabled={state.extended}
            onClick={() => push("extend")}
          >
            {timer("box.extend", { duration: formatMinutes(box / 4, locale) })}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => push(state.paused ? "resume" : "pause")}
          >
            {state.paused ? (
              <Play size={16} aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
            {state.paused ? timer("controls.resume") : timer("controls.pause")}
          </button>
        )}
        {!idle && config.kind === "flow" && state.phase === "work" && (
          <button className="btn btn-secondary" onClick={() => push("break")}>
            {timer("controls.takeBreak")}
          </button>
        )}
        {!idle &&
          config.kind !== "flow" &&
          (state.phase === "work" || state.phase.endsWith("break")) && (
            <button className="btn btn-secondary" onClick={() => push("skip")}>
              <SkipForward size={16} className="rtl-flip" aria-hidden="true" />
              {timer("controls.skip")}
            </button>
          )}
        {!idle && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setEvents([]);
              setNow(0);
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            {t("reset")}
          </button>
        )}
      </div>
      <p className="hint">{t("notSaved")}</p>
      <Link
        href={{ pathname: "/focus", query: { technique } }}
        className="link small"
      >
        {t("fullSession")}
      </Link>
    </div>
  );
}

/** Step checklist for a learning method, next to a short Pomodoro. */
export function TryGuide({ name, steps }: { name: string; steps: string[] }) {
  const t = useTranslations("tryIt");
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card stack">
        <h3 className="card-title">{t("steps")}</h3>
        <ol
          className="stack"
          style={{ gap: 8, listStyle: "none", padding: 0, margin: 0 }}
        >
          {steps.map((step, i) => (
            <li key={i}>
              <label className="flex items-start gap-2 small">
                <input
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={done[i]}
                  onChange={(e) =>
                    setDone(
                      done.map((d, j) => (j === i ? e.target.checked : d)),
                    )
                  }
                />
                <span className={done[i] ? "muted line-through" : ""}>
                  {step}
                </span>
              </label>
            </li>
          ))}
        </ol>
        <Link
          href={{ pathname: "/learn" }}
          className="btn btn-primary btn-sm self-start"
        >
          {t("learnWith", { method: name })}
        </Link>
      </div>
      <TryTimer technique="pomodoro" />
    </div>
  );
}

/** Tiny, local-only planning demos. */
export function TryPlanning({ technique }: { technique: PlanningTechnique }) {
  const t = useTranslations("tryIt");
  const tasks = useTranslations("tasks");
  const [items, setItems] = useState<
    { id: number; title: string; group: string }[]
  >([]);
  const [title, setTitle] = useState("");
  const [frog, setFrog] = useState<number | null>(null);
  const groups =
    technique === "eisenhower"
      ? (["do", "schedule", "delegate", "delete"] as const)
      : technique === "1-3-5"
        ? (["big", "medium", "small"] as const)
        : (["list"] as const);
  const limits: Record<string, number> = {
    big: 1,
    medium: 3,
    small: 5,
    list: technique === "ivy-lee" ? 6 : 8,
    do: 8,
    schedule: 8,
    delegate: 8,
    delete: 8,
  };
  const [group, setGroup] = useState<string>(groups[0]);
  const label = (g: string) =>
    technique === "eisenhower"
      ? tasks(`matrix.${g as "do"}.title`)
      : technique === "1-3-5"
        ? tasks(`plan135.${g as "big"}`)
        : t("list");
  const full = items.filter((i) => i.group === group).length >= limits[group];
  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  return (
    <div className="card stack">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || full) return;
          setItems([
            ...items,
            { id: Date.now(), title: title.trim().slice(0, 120), group },
          ]);
          setTitle("");
        }}
      >
        <input
          className="input"
          style={{ flex: "1 1 200px" }}
          value={title}
          maxLength={120}
          placeholder={t("taskPlaceholder")}
          aria-label={t("taskPlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
        />
        {groups.length > 1 && (
          <select
            className="select"
            style={{ width: "auto" }}
            value={group}
            aria-label={t("where")}
            onChange={(e) => setGroup(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g} value={g}>
                {label(g)}
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-primary" disabled={full || !title.trim()}>
          {t("add")}
        </button>
      </form>
      {full && <p className="hint">{t("full")}</p>}
      <div className={technique === "eisenhower" ? "matrix" : "stack"}>
        {groups.map((g) => {
          const list = items.filter((i) => i.group === g);
          const ordered =
            technique === "eat-the-frog"
              ? [...list].sort(
                  (a, b) => Number(b.id === frog) - Number(a.id === frog),
                )
              : list;
          return (
            <section
              key={g}
              className={technique === "eisenhower" ? "quadrant" : "stack"}
              style={{
                gap: 6,
                minHeight: technique === "eisenhower" ? 120 : undefined,
              }}
            >
              {groups.length > 1 && <h3 className="label">{label(g)}</h3>}
              <ul
                className="stack"
                style={{
                  gap: 6,
                  listStyle: technique === "ivy-lee" ? "decimal" : "none",
                  paddingInlineStart: technique === "ivy-lee" ? 20 : 0,
                  margin: 0,
                }}
              >
                {ordered.map((item) => {
                  const index = items.indexOf(item);
                  return (
                    <li
                      key={item.id}
                      className="task-chip"
                      style={{ touchAction: "auto" }}
                    >
                      {technique === "eat-the-frog" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          aria-pressed={frog === item.id}
                          aria-label={t("markFrog", { title: item.title })}
                          onClick={() =>
                            setFrog(frog === item.id ? null : item.id)
                          }
                        >
                          <Flame
                            size={15}
                            className={
                              frog === item.id ? "text-warning" : "muted"
                            }
                            aria-hidden="true"
                          />
                        </button>
                      )}
                      <span className="flex-1" dir="auto">
                        {item.title}
                      </span>
                      {technique === "ivy-lee" && (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            aria-label={tasks("ivy.moveUp", {
                              title: item.title,
                            })}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            aria-label={tasks("ivy.moveDown", {
                              title: item.title,
                            })}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown size={14} aria-hidden="true" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={t("remove", { title: item.title })}
                        onClick={() =>
                          setItems(items.filter((x) => x.id !== item.id))
                        }
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {technique === "eat-the-frog" && <p className="hint">{t("frogHint")}</p>}
      <p className="hint">{t("notSaved")}</p>
      <Link
        href={{ pathname: "/focus", query: { planning: technique } }}
        className="link small"
      >
        {t("planFull")}
      </Link>
    </div>
  );
}
