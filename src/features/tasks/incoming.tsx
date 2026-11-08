"use client";
import { useLocale, useTranslations } from "next-intl";
import { FolderKanban, Moon } from "lucide-react";
import { formatMinutes } from "@/src/features/focus/format";
import {
  eisenhowerFor,
  flagsOf,
  groupIncoming,
  quadrantOf,
  taskMeta,
  type Quadrant,
} from "./planning";
import type { ClientTask } from "./use-tasks";
import type { Board } from "./day-board";
import { DeleteButton } from "./task-actions";

export type IncomingFilter = {
  quadrant: Quadrant | null;
  projectId: string;
  tag: string;
};

const QUADRANTS: Quadrant[] = ["do", "plan", "quick", "later"];

/** Everything not on today's board: priority tiles, three groups, plan tomorrow. */
export function IncomingPanel({
  board,
  filter,
  onFilter,
  onOpenTask,
  onPlanTomorrow,
  onProjects,
}: {
  board: Board;
  filter: IncomingFilter;
  onFilter: (filter: IncomingFilter) => void;
  onOpenTask: (id: string) => void;
  onPlanTomorrow: () => void;
  onProjects: () => void;
}) {
  const t = useTranslations("tasks.incoming");
  const locale = useLocale();
  const groups = groupIncoming(board.tasks, board.today, board.tomorrow);
  const all = [...groups.tomorrow, ...groups.planned, ...groups.unsorted];
  const matches = (x: ClientTask) =>
    (!filter.quadrant || quadrantOf(x.eisenhower) === filter.quadrant) &&
    (!filter.projectId || x.projectId === filter.projectId) &&
    (!filter.tag || x.tags.includes(filter.tag));
  const duration = (m: number) => formatMinutes(m, locale);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const day = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00Z`));
  const narrowed = Boolean(filter.projectId || filter.tag);

  const sections = [
    { key: "tomorrow", items: groups.tomorrow },
    { key: "planned", items: groups.planned },
    { key: "unsorted", items: groups.unsorted },
  ] as const;

  return (
    <div className="incoming">
      <div className="incoming-head">
        <h2 className="board-h2 is-large">{t("title")}</h2>
        <span className="hint tabular">{all.length}</span>
        <button
          className={
            narrowed
              ? "btn btn-ghost btn-icon btn-sm is-active"
              : "btn btn-ghost btn-icon btn-sm"
          }
          onClick={onProjects}
          aria-label={t("projects")}
          title={t("projects")}
        >
          <FolderKanban size={16} aria-hidden="true" />
        </button>
      </div>

      <div
        className="incoming-quads"
        role="group"
        aria-label={t("filterLabel")}
      >
        {QUADRANTS.map((q) => {
          const on = filter.quadrant === q;
          return (
            <button
              key={q}
              type="button"
              aria-pressed={on}
              className={`incoming-quad is-${q}${on ? " is-on" : ""}`}
              onClick={() => onFilter({ ...filter, quadrant: on ? null : q })}
            >
              <span className="incoming-quad-top">
                <span className="incoming-quad-label">
                  {t(`quadrant.${q}.label`)}
                </span>
                <span className="tabular">
                  {all.filter((x) => quadrantOf(x.eisenhower) === q).length}
                </span>
              </span>
              <span className="incoming-quad-hint">
                {t(`quadrant.${q}.hint`)}
              </span>
            </button>
          );
        })}
      </div>

      {sections.map(({ key, items }) => {
        const visible = items.filter(matches);
        return (
          <section key={key} className="incoming-group">
            <h3 className="incoming-group-title">
              <span>{t(`groups.${key}`)}</span>
              <span className="tabular">{visible.length}</span>
            </h3>
            {visible.length ? (
              <ul className="incoming-list">
                {visible.map((task) => {
                  const flags = flagsOf(task.eisenhower);
                  const when =
                    key === "planned" || (key === "unsorted" && task.plannedFor)
                      ? key === "planned"
                        ? day(task.plannedFor!)
                        : t("missed", { date: day(task.plannedFor!) })
                      : null;
                  const info = [when, taskMeta(task, duration)]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={task.id} className="incoming-row">
                      {key === "tomorrow" && task.ivyRank !== null && (
                        <span className="incoming-rank tabular">
                          {task.ivyRank}
                        </span>
                      )}
                      <button
                        type="button"
                        className="incoming-title"
                        onClick={() => onOpenTask(task.id)}
                        dir="auto"
                      >
                        <span className="incoming-title-text">
                          {task.title}
                        </span>
                        {info && <span className="board-meta">{info}</span>}
                      </button>
                      <button
                        type="button"
                        className={
                          flags.important ? "flag is-important" : "flag"
                        }
                        aria-pressed={flags.important}
                        aria-label={t("importantLabel", { title: task.title })}
                        title={t("important")}
                        onClick={() =>
                          void board.update(task.id, {
                            eisenhower: eisenhowerFor(
                              !flags.important,
                              flags.urgent,
                            ),
                          })
                        }
                      >
                        {t("importantShort")}
                      </button>
                      <button
                        type="button"
                        className={flags.urgent ? "flag is-urgent" : "flag"}
                        aria-pressed={flags.urgent}
                        aria-label={t("urgentLabel", { title: task.title })}
                        title={t("urgent")}
                        onClick={() =>
                          void board.update(task.id, {
                            eisenhower: eisenhowerFor(
                              flags.important,
                              !flags.urgent,
                            ),
                          })
                        }
                      >
                        {t("urgentShort")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm incoming-today"
                        onClick={() => void board.toToday(task)}
                        aria-label={t("toTodayLabel", { title: task.title })}
                      >
                        {t("toToday")}
                      </button>
                      <DeleteButton task={task} board={board} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="incoming-empty">{t(`empty.${key}`)}</p>
            )}
          </section>
        );
      })}

      <button type="button" className="incoming-plan" onClick={onPlanTomorrow}>
        <Moon size={22} aria-hidden="true" />
        <span>
          <span className="incoming-plan-title">{t("plan")}</span>
          <span className="incoming-plan-hint">{t("planHint")}</span>
        </span>
      </button>
    </div>
  );
}
