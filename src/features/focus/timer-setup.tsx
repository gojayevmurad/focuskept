"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import type { TimeTechnique } from "@/src/features/techniques/slugs";
import {
  recommendTechnique,
  type RecommendationSession,
} from "@/src/features/techniques/recommend";
import type {
  CustomPreset,
  TechniqueSettings,
  TimerDurations,
} from "@/src/lib/db/json-types";
import { durationsFor, timeboxMinutes } from "@/src/features/timer/configs";
import { CUSTOM_LIMITS, TIMEBOX_LIMITS } from "@/src/features/timer/limits";
import type { StoreTask } from "./stores";
import type { TechniqueLabels } from "./labels";
import { RhythmPicker } from "./rhythm-picker";
import { RHYTHMS, WORK_ONLY, rhythmMeta, rhythmShape } from "./rhythm";
import { formatClock } from "./format";
import type { Day } from "./day-panel";

export type Mode = "work" | "learning";

export type SetupResult = {
  mode: Mode;
  technique: TimeTechnique;
  /** Learning topic or Working goal; may be empty (asked again at the end). */
  subject: string;
  task?: StoreTask | { title: string; isNew: true };
  durations?: TimerDurations;
  boxMinutes?: number;
  projectId?: string | null;
  subjectId?: string | null;
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(v)));

/** The timer card (DESIGN: Timer home): mode, subject, one Rhythm control, Start. */
export function TimerSetup({
  tasks,
  labels,
  sessions,
  settings,
  initialTechnique,
  initialTaskId,
  initialMode = "learning",
  initialSubject = "",
  defaultTechnique,
  secondaryStart,
  day,
  onSettingsChange,
  onStart,
}: {
  tasks: StoreTask[];
  labels: TechniqueLabels;
  sessions: RecommendationSession[];
  settings: TechniqueSettings;
  presets?: CustomPreset[];
  initialTechnique?: TimeTechnique;
  initialTaskId?: string;
  initialMode?: Mode;
  initialSubject?: string;
  defaultTechnique?: TimeTechnique;
  signedIn?: boolean;
  /** Start is secondary when reviews are due (the review strip is primary). */
  secondaryStart?: boolean;
  /** Signed in: projects, subjects and recent topics to pick from. */
  day?: Day;
  onSettingsChange: (settings: TechniqueSettings) => void;
  onStart: (result: SetupResult) => void;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const initialTask = tasks.find((x) => x.id === initialTaskId);
  const [mode, setMode] = useState<Mode>(initialTask ? "work" : initialMode);
  const [subject, setSubject] = useState(initialTask?.title ?? initialSubject);
  const [taskId, setTaskId] = useState<string | undefined>(initialTask?.id);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(
    initialTask?.projectId ?? null,
  );
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState<string | null>(null);

  const task = tasks.find((x) => x.id === taskId);
  const recommendation = useMemo(
    () => recommendTechnique({ sessions, tag: task?.tags[0] }),
    [sessions, task],
  );
  const suggested =
    recommendation.reason.key === "default" && defaultTechnique
      ? defaultTechnique
      : recommendation.technique;
  const [chosen, setChosen] = useState<TimeTechnique | undefined>(
    initialTechnique,
  );
  let technique = chosen ?? suggested;
  if (mode === "learning" && WORK_ONLY.includes(technique))
    technique = "pomodoro";

  const [boxMinutes, setBoxMinutes] = useState<number>(() =>
    timeboxMinutes(settings, initialTask?.estimatedMinutes ?? undefined),
  );
  const custom = durationsFor("custom", settings)!;
  const shape = rhythmShape(technique, settings, { boxMinutes });
  const options = RHYTHMS.filter(
    (slug) => mode === "work" || !WORK_ONLY.includes(slug),
  ).map((slug) => ({
    slug,
    meta: rhythmMeta(rhythmShape(slug, settings, { boxMinutes })),
  }));

  const previewMinutes =
    shape.kind === "cycle"
      ? shape.work
      : shape.kind === "box"
        ? shape.minutes
        : 0;
  const summary =
    shape.kind === "cycle"
      ? t("summaryCycle", { blocks: shape.blocks, minutes: shape.brk })
      : shape.kind === "flow"
        ? t("summaryFlow")
        : t("summaryBox");

  const steppers =
    technique === "timeboxing"
      ? [
          {
            key: "box",
            label: t("boxMinutes"),
            value: boxMinutes,
            step: 5,
            set: (v: number) =>
              setBoxMinutes(clamp(v, TIMEBOX_LIMITS.min, TIMEBOX_LIMITS.max)),
          },
        ]
      : technique === "custom"
        ? [
            {
              key: "work",
              label: t("focusMinutes"),
              value: custom.work,
              step: 5,
              set: (v: number) =>
                onSettingsChange({
                  ...settings,
                  custom: {
                    ...custom,
                    work: clamp(
                      v,
                      CUSTOM_LIMITS.work.min,
                      CUSTOM_LIMITS.work.max,
                    ),
                  },
                }),
            },
            {
              key: "break",
              label: t("breakMinutes"),
              value: custom.shortBreak,
              step: 1,
              set: (v: number) =>
                onSettingsChange({
                  ...settings,
                  custom: {
                    ...custom,
                    shortBreak: clamp(
                      v,
                      CUSTOM_LIMITS.shortBreak.min,
                      CUSTOM_LIMITS.shortBreak.max,
                    ),
                  },
                }),
            },
          ]
        : [];

  const trimmed = subject.trim();
  const exact = tasks.find(
    (x) => x.title.toLowerCase() === trimmed.toLowerCase(),
  );
  const suggestions =
    mode === "work" && !trimmed
      ? [...tasks]
          .filter((x) => !projectId || x.projectId === projectId)
          .sort((a, b) => Number(b.frog) - Number(a.frog))
          .slice(0, 3)
      : [];
  const topicSuggestions =
    mode === "learning" && !trimmed && day
      ? [
          ...new Set(
            day.topics
              .filter((x) => !subjectId || x.subjectId === subjectId)
              .map((x) => x.topic),
          ),
        ].slice(0, 3)
      : [];
  const groups =
    mode === "learning" ? (day?.subjects ?? []) : (day?.projects ?? []);
  const groupId = mode === "learning" ? subjectId : projectId;
  const setGroup = (id: string | null) =>
    mode === "learning" ? setSubjectId(id) : setProjectId(id);

  async function createSubject() {
    const name = newSubject?.trim();
    if (!name || !day) return setNewSubject(null);
    const created = await day.addSubject(name.slice(0, 60));
    if (created) setSubjectId(created.id);
    setNewSubject(null);
  }

  return (
    <form
      className="timer-card"
      onSubmit={(e) => {
        e.preventDefault();
        const chosenTask: SetupResult["task"] =
          mode !== "work"
            ? undefined
            : task
              ? task
              : exact
                ? exact
                : trimmed
                  ? { title: trimmed, isNew: true }
                  : undefined;
        onStart({
          mode,
          technique,
          subject: trimmed,
          task: chosenTask,
          durations:
            technique === "custom"
              ? custom
              : technique === "pomodoro"
                ? durationsFor("pomodoro", settings)!
                : undefined,
          boxMinutes: technique === "timeboxing" ? boxMinutes : undefined,
          projectId: mode === "work" ? projectId : null,
          subjectId: mode === "learning" ? subjectId : null,
        });
      }}
    >
      <div role="radiogroup" aria-label={t("modeLabel")} className="segmented">
        {(["learning", "work"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => {
              if (m === mode) return;
              setMode(m);
              setSubject("");
              setTaskId(undefined);
            }}
          >
            {m === "learning" ? t("learn") : t("work")}
          </button>
        ))}
      </div>

      {day && (groups.length > 0 || mode === "learning") && (
        <div
          className="timer-groups"
          role="group"
          aria-label={mode === "learning" ? t("subjects") : t("projects")}
        >
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={groupId === g.id ? "chip is-active" : "chip"}
              aria-pressed={groupId === g.id}
              onClick={() => {
                setGroup(groupId === g.id ? null : g.id);
                if (mode === "work") {
                  setSubject("");
                  setTaskId(undefined);
                }
              }}
            >
              <span
                className={
                  mode === "learning" ? "project-dot is-round" : "project-dot"
                }
                style={{ background: g.color }}
                aria-hidden="true"
              />
              {g.name}
            </button>
          ))}
          {mode === "learning" &&
            (newSubject === null ? (
              <button
                type="button"
                className="chip is-dashed"
                onClick={() => setNewSubject("")}
              >
                <Plus size={14} aria-hidden="true" />
                {t("newSubject")}
              </button>
            ) : (
              <span className="timer-new-group">
                <input
                  className="input"
                  autoFocus
                  value={newSubject}
                  maxLength={60}
                  placeholder={t("newSubjectPlaceholder")}
                  aria-label={t("newSubject")}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void createSubject();
                    }
                    if (e.key === "Escape") setNewSubject(null);
                  }}
                  dir="auto"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void createSubject()}
                >
                  {t("addSubject")}
                </button>
              </span>
            ))}
        </div>
      )}

      <div className="timer-subject">
        <label htmlFor="timer-subject">
          {mode === "learning" ? t("subjectLearn") : t("subjectWork")}
        </label>
        <input
          id="timer-subject"
          dir="auto"
          autoComplete="off"
          maxLength={200}
          value={subject}
          placeholder={
            mode === "learning" ? t("placeholderLearn") : t("placeholderWork")
          }
          onChange={(e) => {
            setSubject(e.target.value);
            setTaskId(undefined);
          }}
        />
        {suggestions.length > 0 && (
          <div className="timer-suggest">
            <span>{t("fromPlan")}</span>
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                className="chip"
                dir="auto"
                onClick={() => {
                  setSubject(s.title);
                  setTaskId(s.id);
                  if (s.projectId) setProjectId(s.projectId);
                  if (s.estimatedMinutes)
                    setBoxMinutes(
                      clamp(
                        s.estimatedMinutes,
                        TIMEBOX_LIMITS.min,
                        TIMEBOX_LIMITS.max,
                      ),
                    );
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {topicSuggestions.length > 0 && (
        <div className="timer-suggest is-topics">
          <span>{t("continueTopic")}</span>
          {topicSuggestions.map((topic) => (
            <button
              key={topic}
              type="button"
              className="chip"
              dir="auto"
              onClick={() => setSubject(topic)}
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      <div className="timer-controls">
        <RhythmPicker
          value={technique}
          meta={rhythmMeta(shape)}
          options={options}
          labels={labels}
          open={open}
          onOpenChange={setOpen}
          onChange={setChosen}
        />
        {steppers.map((s) => (
          <div key={s.key} className="stepper">
            <span>{s.label}</span>
            <button
              type="button"
              aria-label={t("decrease", { label: s.label })}
              onClick={() => s.set(s.value - s.step)}
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <output className="tabular">
              {new Intl.NumberFormat(locale).format(s.value)}
            </output>
            <button
              type="button"
              aria-label={t("increase", { label: s.label })}
              onClick={() => s.set(s.value + s.step)}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="timer-foot">
        <div>
          <div className="timer-preview ltr-island">
            {formatClock(previewMinutes * 60_000, locale)}
          </div>
          <p className="timer-summary">{summary}</p>
        </div>
        <button
          type="submit"
          className={
            secondaryStart
              ? "btn btn-secondary btn-lg"
              : "btn btn-primary btn-lg"
          }
        >
          {t("start")}
        </button>
      </div>
    </form>
  );
}
