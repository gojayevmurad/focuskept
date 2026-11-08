"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Play, Search } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { addDays } from "@/src/lib/dates";
import { useDayName } from "./add-bar";
import { taskMeta } from "./planning";
import { CheckButton, DeleteButton } from "./task-actions";
import type { ClientProject, ClientTask } from "./use-tasks";
import type { Board } from "./day-board";

type Group = "late" | "today" | "tomorrow" | "week" | "later" | "none" | "done";
const GROUPS: Group[] = [
  "late",
  "today",
  "tomorrow",
  "week",
  "later",
  "none",
  "done",
];

/** Every task in one list: search, project filter, date groups and bulk actions. */
export function AllTasks({
  board,
  projects,
  onOpenTask,
  duration,
}: {
  board: Board;
  projects: ClientProject[];
  onOpenTask: (id: string) => void;
  duration: (minutes: number) => string;
}) {
  const t = useTranslations("tasks");
  const dayName = useDayName(board.today, board.tomorrow);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const weekEnd = addDays(board.today, 7);

  const groupOf = (x: ClientTask): Group =>
    x.status === "done"
      ? "done"
      : !x.plannedFor
        ? "none"
        : x.plannedFor < board.today
          ? "late"
          : x.plannedFor === board.today
            ? "today"
            : x.plannedFor === board.tomorrow
              ? "tomorrow"
              : x.plannedFor <= weekEnd
                ? "week"
                : "later";
  const q = query.trim().toLowerCase();
  const visible = board.tasks.filter(
    (x) =>
      x.status !== "archived" &&
      (!projectId || x.projectId === projectId) &&
      (!q ||
        x.title.toLowerCase().includes(q) ||
        x.tags.some((tag) => tag.includes(q))),
  );
  const groups = GROUPS.map((key) => ({
    key,
    items: visible
      .filter((x) => groupOf(x) === key)
      .sort((a, b) => (a.plannedFor ?? "").localeCompare(b.plannedFor ?? "")),
  })).filter((g) => g.items.length);
  const chosen = board.tasks.filter((x) => selected.includes(x.id));
  const project = (id: string | null) => projects.find((p) => p.id === id);

  async function bulk(action: "today" | "tomorrow" | "none" | "done") {
    setBusy(true);
    for (const task of chosen) {
      const ok =
        action === "done"
          ? await board.setDone(task, true)
          : await board.toDay(
              task,
              action === "today"
                ? board.today
                : action === "tomorrow"
                  ? board.tomorrow
                  : null,
            );
      // A full day or a full tomorrow list stops the rest.
      if (!ok) break;
    }
    setBusy(false);
    finish();
  }
  function finish() {
    setSelected([]);
    setSelecting(false);
  }

  return (
    <section className="all" aria-label={t("all.heading")}>
      <div className="all-tools">
        <label className="all-search">
          <Search size={16} aria-hidden="true" />
          <input
            className="all-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("all.search")}
            aria-label={t("all.search")}
            dir="auto"
          />
        </label>
        <div
          className="all-filters"
          role="group"
          aria-label={t("board.project.label")}
        >
          {[null, ...projects.filter((p) => !p.archivedAt)].map((p) => (
            <button
              key={p?.id ?? "all"}
              type="button"
              className={
                projectId === (p?.id ?? null)
                  ? "picker-chip is-active"
                  : "picker-chip"
              }
              aria-pressed={projectId === (p?.id ?? null)}
              onClick={() => setProjectId(p?.id ?? null)}
            >
              {p && (
                <span
                  className="project-dot"
                  style={{ background: p.color }}
                  aria-hidden="true"
                />
              )}
              {p?.name ?? t("all.allProjects")}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={selecting ? "picker-chip is-active" : "picker-chip"}
          aria-pressed={selecting}
          onClick={() => (selecting ? finish() : setSelecting(true))}
        >
          {selecting ? t("all.selectDone") : t("all.select")}
        </button>
      </div>

      {selecting && chosen.length > 0 && (
        <div className="all-bulk" role="toolbar" aria-label={t("all.bulk")}>
          <span className="all-bulk-count">
            {t("all.selected", { count: chosen.length })}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => void bulk("today")}
          >
            {t("incoming.toToday")}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => void bulk("tomorrow")}
          >
            {t("board.toTomorrow")}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => void bulk("none")}
          >
            {t("board.date.none")}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => void bulk("done")}
          >
            {t("all.markDone")}
          </button>
          <button
            className="btn btn-secondary btn-sm text-danger"
            disabled={busy}
            onClick={() => {
              board.deleteTasks(chosen);
              finish();
            }}
          >
            {t("board.delete")}
          </button>
        </div>
      )}

      {groups.map((group) => (
        <section
          key={group.key}
          className="all-group"
          aria-labelledby={`all-${group.key}`}
        >
          <h2
            id={`all-${group.key}`}
            className={
              group.key === "late"
                ? "all-group-title is-late"
                : "all-group-title"
            }
          >
            {t(`all.groups.${group.key}`)}
            <span className="hint tabular">{group.items.length}</span>
          </h2>
          <ul className="board-rows">
            {group.items.map((task) => {
              const p = project(task.projectId);
              const isSelected = selected.includes(task.id);
              const info = taskMeta(task, duration);
              return (
                <li key={task.id} className="board-row all-row">
                  {selecting ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={t("all.selectLabel", { title: task.title })}
                      className={`board-check is-select${isSelected ? " is-done" : ""}`}
                      onClick={() =>
                        setSelected((list) =>
                          isSelected
                            ? list.filter((id) => id !== task.id)
                            : [...list, task.id],
                        )
                      }
                    >
                      {isSelected && (
                        <Check size={13} strokeWidth={3} aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <CheckButton task={task} board={board} />
                  )}
                  <button
                    type="button"
                    className={
                      task.status === "done"
                        ? "board-task-title is-done"
                        : "board-task-title"
                    }
                    onClick={() => onOpenTask(task.id)}
                    aria-label={t("board.edit", { title: task.title })}
                    dir="auto"
                  >
                    {task.title}
                    {info && <span className="board-meta">{info}</span>}
                  </button>
                  {p && (
                    <span className="all-project">
                      <span
                        className="project-dot"
                        style={{ background: p.color }}
                        aria-hidden="true"
                      />
                      {p.name}
                    </span>
                  )}
                  {task.plannedFor && group.key !== "done" && (
                    <span
                      className={
                        group.key === "late" ? "all-date is-late" : "all-date"
                      }
                    >
                      {dayName(task.plannedFor)}
                    </span>
                  )}
                  {!selecting && (
                    <span className="board-actions">
                      {task.status !== "done" && (
                        <Link
                          href={{
                            pathname: "/app/focus",
                            query: { task: task.id },
                          }}
                          className="btn btn-ghost btn-icon btn-sm board-play"
                          aria-label={t("focusOn", { title: task.title })}
                        >
                          <Play size={14} aria-hidden="true" />
                        </Link>
                      )}
                      <DeleteButton task={task} board={board} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!groups.length && <p className="all-empty">{t("all.empty")}</p>}
    </section>
  );
}
