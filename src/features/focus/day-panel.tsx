"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Play,
  Plus,
} from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { Dialog } from "@/src/components/ui/dialog";
import { toast } from "@/src/components/ui/toast";
import { freeSlot, type Size } from "@/src/features/tasks/planning";
import { formatMinutes } from "./format";
import type { ActiveSession } from "./active-session";

export type DayTask = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  size135: Size | null;
  status: "todo" | "done";
  projectId: string | null;
  notes: string | null;
};
export type Tag = { id: string; name: string; color: string };
export type DayData = {
  today: string;
  tasks: DayTask[];
  projects: Tag[];
  subjects: Tag[];
  topics: { subjectId: string | null; topic: string }[];
};
export type Day = ReturnType<typeof useDay>;

const ORDER: (Size | null)[] = ["big", "medium", "small", null];
const SUBJECT_COLORS = ["#5FC3A8", "#F2B33D", "#9DB4E0", "#E59C8C", "#B9A3E3"];

async function request(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error("request");
  return response.status === 204 ? null : response.json();
}

/** Today's tasks and the user's subjects, kept in sync with the API. */
export function useDay(initial: DayData) {
  const t = useTranslations("home.day");
  const [tasks, setTasks] = useState(initial.tasks);
  const [subjects, setSubjects] = useState(initial.subjects);
  const sorted = [...tasks].sort(
    (a, b) =>
      Number(a.status === "done") - Number(b.status === "done") ||
      ORDER.indexOf(a.size135) - ORDER.indexOf(b.size135),
  );
  const open = sorted.filter((x) => x.status !== "done");

  async function setDone(task: DayTask, done: boolean) {
    const status = done ? "done" : "todo";
    setTasks((list) =>
      list.map((x) => (x.id === task.id ? { ...x, status } : x)),
    );
    try {
      await request(`/api/tasks/${task.id}`, "PATCH", { status });
      return true;
    } catch {
      setTasks((list) => list.map((x) => (x.id === task.id ? task : x)));
      toast(t("error"), "error");
      return false;
    }
  }

  async function add(title: string) {
    const size = freeSlot(
      tasks.map((x) => ({ ...x, plannedFor: initial.today })),
      initial.today,
      "medium",
    );
    if (!size) {
      toast(t("full"), "error");
      return;
    }
    const id = crypto.randomUUID();
    const task: DayTask = {
      id,
      title,
      estimatedMinutes: null,
      size135: size,
      status: "todo",
      projectId: null,
      notes: null,
    };
    setTasks((list) => [...list, task]);
    try {
      await request("/api/tasks", "POST", {
        title,
        clientId: id,
        plannedFor: initial.today,
        size135: size,
        isFrogOn: size === "big" ? initial.today : null,
      });
    } catch {
      setTasks((list) => list.filter((x) => x.id !== id));
      toast(t("error"), "error");
    }
  }

  async function addSubject(name: string) {
    try {
      const row = (await request("/api/subjects", "POST", {
        name,
        color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length],
      })) as Tag;
      setSubjects((list) =>
        list.some((s) => s.id === row.id) ? list : [...list, row],
      );
      return row;
    } catch {
      toast(t("error"), "error");
      return null;
    }
  }

  return {
    today: initial.today,
    projects: initial.projects,
    topics: initial.topics,
    subjects,
    tasks: sorted,
    open,
    done: tasks.filter((x) => x.status === "done").length,
    setDone,
    add,
    addSubject,
  };
}

/** Under the timer card: today's progress and the next task; opens the day sheet. */
export function DayStrip({ day, onOpen }: { day: Day; onOpen: () => void }) {
  const t = useTranslations("home.day");
  const locale = useLocale();
  const next = day.open[0];
  return (
    <button
      type="button"
      className="day-strip"
      onClick={onOpen}
      aria-haspopup="dialog"
    >
      <span className="day-strip-count">
        <span className="day-strip-label">{t("title")}</span>
        <span className="tabular">
          {t("count", { done: day.done, total: day.tasks.length })}
        </span>
      </span>
      <span className="day-strip-next">
        <span className="day-strip-label is-next">
          {next ? t("next") : t("title")}
        </span>
        <span className="day-strip-title" dir="auto">
          {next
            ? [
                next.title,
                next.estimatedMinutes
                  ? formatMinutes(next.estimatedMinutes, locale)
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : day.tasks.length
              ? t("allDone")
              : t("empty")}
        </span>
      </span>
      <ChevronRight size={16} aria-hidden="true" className="rtl-flip" />
    </button>
  );
}

/** Today's list with check, Focus and a quick add, without leaving the timer. */
export function DaySheet({
  open,
  onClose,
  day,
  onFocus,
}: {
  open: boolean;
  onClose: () => void;
  day: Day;
  onFocus?: (task: DayTask) => void;
}) {
  const t = useTranslations("home.day");
  const locale = useLocale();
  const [text, setText] = useState("");
  const total = day.tasks.length;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="sheet"
      side
      labelledBy="day-sheet-title"
    >
      <div className="day-sheet">
        <h2 id="day-sheet-title" className="day-sheet-title">
          {t("title")}
        </h2>
        <div
          className="day-sheet-bar"
          role="img"
          aria-label={t("count", { done: day.done, total })}
        >
          <span
            style={{ inlineSize: `${total ? (day.done / total) * 100 : 0}%` }}
          />
        </div>
        <form
          className="day-sheet-add"
          onSubmit={(e) => {
            e.preventDefault();
            const title = text.trim();
            if (!title) return;
            setText("");
            void day.add(title.slice(0, 200));
          }}
        >
          <input
            className="input"
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("add")}
            aria-label={t("add")}
            dir="auto"
          />
          <button
            className="btn btn-primary btn-icon"
            aria-label={t("add")}
            disabled={!text.trim()}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </form>
        <ul className="day-list">
          {day.tasks.map((task) => (
            <DayRow
              key={task.id}
              task={task}
              day={day}
              meta={
                task.estimatedMinutes
                  ? formatMinutes(task.estimatedMinutes, locale)
                  : ""
              }
              action={
                onFocus &&
                task.status !== "done" && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onFocus(task)}
                    aria-label={t("focusLabel", { title: task.title })}
                  >
                    <Play size={13} aria-hidden="true" />
                    {t("focus")}
                  </button>
                )
              }
            />
          ))}
          {!total && <li className="day-empty">{t("empty")}</li>}
        </ul>
        <Link href="/app/tasks" className="day-sheet-link">
          {t("allTasks")}
        </Link>
      </div>
    </Dialog>
  );
}

function DayRow({
  task,
  day,
  meta,
  action,
}: {
  task: DayTask;
  day: Day;
  meta: string;
  action?: React.ReactNode;
}) {
  const t = useTranslations("home.day");
  const done = task.status === "done";
  return (
    <li className="day-row">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={t("markDone", { title: task.title })}
        className={`board-check${done ? " is-done" : ""}`}
        onClick={() => void day.setDone(task, !done)}
      >
        {done && <Check size={13} strokeWidth={3} aria-hidden="true" />}
      </button>
      <span
        className={done ? "day-row-title is-done" : "day-row-title"}
        dir="auto"
      >
        {task.title}
        {meta && <span className="board-meta">{meta}</span>}
      </span>
      {action}
    </li>
  );
}

const PANEL_KEY = "focuskept:v1:panel";

/**
 * Beside the running timer on wide screens: the current task or topic, then
 * what comes next. Narrow screens get a button that opens the day sheet.
 */
export function FocusPanel({
  session,
  day,
  onSessionChange,
}: {
  session: ActiveSession;
  day: Day;
  onSessionChange: (next: ActiveSession) => void;
}) {
  const t = useTranslations("home.day");
  const locale = useLocale();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(PANEL_KEY) === "hidden";
    } catch {
      return false;
    }
  });
  const [sheet, setSheet] = useState(false);
  const toggle = (next: boolean) => {
    setHidden(next);
    try {
      localStorage.setItem(PANEL_KEY, next ? "hidden" : "shown");
    } catch {}
  };

  const current = day.tasks.find((x) => x.id === session.task?.id);
  const others = day.open.filter((x) => x.id !== session.task?.id);
  const switchTo = (task: DayTask | undefined) =>
    onSessionChange({
      ...session,
      task: task ? { id: task.id, title: task.title } : session.task,
      goal: task ? task.title : session.goal,
      projectId: task ? task.projectId : session.projectId,
    });
  const subject = day.subjects.find((s) => s.id === session.subjectId);
  const topics = day.topics
    .filter((x) => x.subjectId === (session.subjectId ?? null))
    .map((x) => x.topic)
    .filter((x) => x !== session.learning?.topic)
    .slice(0, 5);
  const notes = (session.learning?.notes.notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const minutes = (task: DayTask) =>
    task.estimatedMinutes ? formatMinutes(task.estimatedMinutes, locale) : "";

  return (
    <>
      <button
        type="button"
        className="focus-day-button focus-chrome"
        onClick={() => setSheet(true)}
        aria-haspopup="dialog"
      >
        <ListTodo size={16} aria-hidden="true" />
        {t("title")}
        <span className="tabular">
          {t("count", { done: day.done, total: day.tasks.length })}
        </span>
      </button>
      <DaySheet open={sheet} onClose={() => setSheet(false)} day={day} />

      {hidden ? (
        <button
          type="button"
          className="focus-panel-rail focus-chrome"
          onClick={() => toggle(false)}
          aria-label={t("show")}
        >
          <ChevronLeft size={16} aria-hidden="true" className="rtl-flip" />
          <span className="tabular">
            {t("count", { done: day.done, total: day.tasks.length })}
          </span>
        </button>
      ) : (
        <aside className="focus-panel focus-chrome" aria-label={t("panel")}>
          <div className="focus-panel-head">
            <h2>{session.mode === "learning" ? t("session") : t("now")}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => toggle(true)}
              aria-label={t("hide")}
            >
              <ChevronRight size={16} aria-hidden="true" className="rtl-flip" />
            </button>
          </div>

          {session.mode === "learning" ? (
            <>
              <section className="focus-panel-card">
                {subject && (
                  <p className="focus-panel-meta">
                    <span
                      className="project-dot is-round"
                      style={{ background: subject.color }}
                      aria-hidden="true"
                    />
                    {subject.name}
                  </p>
                )}
                <p className="focus-panel-title" dir="auto">
                  {session.learning?.topic || t("noTopic")}
                </p>
              </section>
              {notes.length > 0 && (
                <section>
                  <h3 className="focus-panel-h3">{t("notes")}</h3>
                  {notes.map((line, i) => (
                    <p key={i} className="focus-panel-note" dir="auto">
                      {line}
                    </p>
                  ))}
                </section>
              )}
              {topics.length > 0 && (
                <section>
                  <h3 className="focus-panel-h3">
                    {subject
                      ? t("recentIn", { subject: subject.name })
                      : t("recent")}
                  </h3>
                  <ul className="day-list">
                    {topics.map((topic) => (
                      <li key={topic} className="focus-panel-topic" dir="auto">
                        {topic}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <>
              <section className="focus-panel-card">
                {current?.projectId && (
                  <ProjectName day={day} id={current.projectId} />
                )}
                <p className="focus-panel-title" dir="auto">
                  {session.task?.title || session.goal || t("noTopic")}
                </p>
                {current?.notes && (
                  <p className="focus-panel-note is-pre" dir="auto">
                    {current.notes}
                  </p>
                )}
                {current && current.status !== "done" && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      if (await day.setDone(current, true)) switchTo(others[0]);
                    }}
                  >
                    <Check size={14} aria-hidden="true" />
                    {t("finishTask")}
                  </button>
                )}
              </section>
              <section>
                <h3 className="focus-panel-h3">{t("upNext")}</h3>
                <ul className="day-list">
                  {others.slice(0, 5).map((task) => (
                    <DayRow
                      key={task.id}
                      task={task}
                      day={day}
                      meta={minutes(task)}
                      action={
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => switchTo(task)}
                          aria-label={t("switchLabel", { title: task.title })}
                        >
                          {t("switch")}
                        </button>
                      }
                    />
                  ))}
                  {!others.length && (
                    <li className="day-empty">{t("noNext")}</li>
                  )}
                </ul>
              </section>
            </>
          )}
          <button
            type="button"
            className="day-sheet-link"
            onClick={() => setSheet(true)}
          >
            {t("openDay")}
          </button>
        </aside>
      )}
    </>
  );
}

function ProjectName({ day, id }: { day: Day; id: string }) {
  const project = day.projects.find((p) => p.id === id);
  if (!project) return null;
  return (
    <p className="focus-panel-meta">
      <span
        className="project-dot"
        style={{ background: project.color }}
        aria-hidden="true"
      />
      {project.name}
    </p>
  );
}
