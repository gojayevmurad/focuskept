"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, X } from "lucide-react";
import { Dialog } from "@/src/components/ui/dialog";
import { toast } from "@/src/components/ui/toast";
import { taskMeta } from "./planning";
import {
  projectRequest,
  type ClientProject,
  type ClientTask,
} from "./use-tasks";
import type { Board } from "./day-board";
import type { IncomingFilter } from "./incoming";

const IVY_MAX = 6;

/** Evening step (Ivy Lee): up to six tasks for tomorrow, in order. */
export function PlanTomorrowDialog({
  open,
  board,
  onClose,
  duration,
}: {
  open: boolean;
  board: Board;
  onClose: () => void;
  duration: (m: number) => string;
}) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="plan-tomorrow-title" wide>
      {open && (
        <PlanTomorrow board={board} onClose={onClose} duration={duration} />
      )}
    </Dialog>
  );
}

function PlanTomorrow({
  board,
  onClose,
  duration,
}: {
  board: Board;
  onClose: () => void;
  duration: (m: number) => string;
}) {
  const t = useTranslations("tasks.planner");
  const [order, setOrder] = useState(() =>
    board.tasks
      .filter(
        (x) =>
          x.plannedFor === board.tomorrow &&
          x.ivyRank !== null &&
          x.status !== "archived",
      )
      .sort((a, b) => (a.ivyRank ?? 0) - (b.ivyRank ?? 0))
      .map((x) => x.id),
  );
  const [saving, setSaving] = useState(false);
  const byId = (id: string) => board.tasks.find((x) => x.id === id);
  const pool = board.tasks.filter(
    (x) =>
      (x.status === "todo" || x.status === "doing") && !order.includes(x.id),
  );
  const full = order.length >= IVY_MAX;

  return (
    <>
      <div>
        <h2 id="plan-tomorrow-title" className="card-title">
          {t("title")}
        </h2>
        <p className="hint mt-1">{t("lead")}</p>
      </div>
      <div className="planner">
        <div>
          <p className="planner-label">{t("pick")}</p>
          <ul className="planner-pool">
            {pool.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="planner-option"
                  disabled={full}
                  onClick={() => setOrder((list) => [...list, task.id])}
                  dir="auto"
                >
                  <span>{task.title}</span>
                  <span className="board-meta">
                    {task.plannedFor === board.today
                      ? t("fromToday")
                      : taskMeta(task, duration)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="planner-order">
          <p className="planner-label is-accent">
            {t("order", { count: order.length, max: IVY_MAX })}
          </p>
          {order.length ? (
            <ol className="planner-list">
              {order.map((id, i) => {
                const task = byId(id);
                if (!task) return null;
                return (
                  <li key={id} className="planner-item">
                    <span
                      className={i === 0 ? "planner-n is-first" : "planner-n"}
                    >
                      {i + 1}
                    </span>
                    <span className="planner-item-title" dir="auto">
                      {task.title}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      disabled={i === 0}
                      aria-label={t("moveUp", { title: task.title })}
                      onClick={() =>
                        setOrder((list) => {
                          const next = [...list];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return next;
                        })
                      }
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      aria-label={t("remove", { title: task.title })}
                      onClick={() =>
                        setOrder((list) => list.filter((x) => x !== id))
                      }
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="hint">{t("empty")}</p>
          )}
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {t("later")}
        </button>
        <button
          type="button"
          className="btn btn-amber"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const saved = await board.saveTomorrow(order);
            setSaving(false);
            if (!saved) return;
            onClose();
            toast(t("saved"));
          }}
        >
          {t("save")}
        </button>
      </div>
    </>
  );
}

type Day = "today" | "tomorrow" | "none" | "other";

/** Task details: everything the old All tab could edit, in one dialog. */
export function TaskDetailsDialog({
  task,
  board,
  projects,
  onClose,
}: {
  task: ClientTask | null;
  board: Board;
  projects: ClientProject[];
  onClose: () => void;
}) {
  return (
    <Dialog open={task !== null} onClose={onClose} labelledBy="task-details">
      {task && (
        <TaskDetails
          key={task.id}
          task={task}
          board={board}
          projects={projects}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function TaskDetails({
  task,
  board,
  projects,
  onClose,
}: {
  task: ClientTask;
  board: Board;
  projects: ClientProject[];
  onClose: () => void;
}) {
  const t = useTranslations("tasks.details");
  const tasksT = useTranslations("tasks");
  const initialDay: Day =
    task.plannedFor === board.today
      ? "today"
      : task.plannedFor === board.tomorrow
        ? "tomorrow"
        : task.plannedFor
          ? "other"
          : "none";
  const [day, setDay] = useState<Day>(initialDay);

  async function save(data: FormData) {
    const minutes = Number(data.get("minutes"));
    const ok = await board.update(task.id, {
      title: String(data.get("title")).trim() || task.title,
      estimatedMinutes:
        Number.isFinite(minutes) && minutes > 0
          ? Math.min(1440, Math.round(minutes))
          : null,
      tags: [
        ...new Set(
          String(data.get("tags") ?? "")
            .split(/[,#\s]+/)
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean),
        ),
      ].slice(0, 10),
      projectId: String(data.get("project") ?? "") || null,
      notes: String(data.get("notes") ?? "").trim() || null,
    });
    if (!ok) return;
    if (day !== initialDay) {
      const latest = { ...task, estimatedMinutes: minutes || null };
      if (day === "today") await board.toToday(latest);
      else if (day === "tomorrow") await board.toTomorrow(latest);
      else if (day === "none") await board.toIncoming(latest);
    }
    onClose();
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save(new FormData(e.currentTarget));
      }}
    >
      <h2 id="task-details" className="card-title">
        {t("title")}
      </h2>
      <label className="field">
        <span className="label">{t("name")}</span>
        <input
          name="title"
          className="input"
          defaultValue={task.title}
          maxLength={200}
          required
          dir="auto"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span className="label">{t("minutes")}</span>
          <input
            name="minutes"
            className="input tabular"
            type="number"
            min={1}
            max={1440}
            defaultValue={task.estimatedMinutes ?? ""}
          />
        </label>
        <label className="field">
          <span className="label">{t("day")}</span>
          <select
            className="select"
            value={day}
            onChange={(e) => setDay(e.target.value as Day)}
          >
            <option value="today">{t("days.today")}</option>
            <option value="tomorrow">{t("days.tomorrow")}</option>
            <option value="none">{t("days.none")}</option>
            {initialDay === "other" && (
              <option value="other">{task.plannedFor}</option>
            )}
          </select>
        </label>
        <label className="field">
          <span className="label">{t("tags")}</span>
          <input
            name="tags"
            className="input"
            defaultValue={task.tags.join(", ")}
            placeholder={t("tagsPlaceholder")}
          />
        </label>
        <label className="field">
          <span className="label">{t("project")}</span>
          <select
            name="project"
            className="select"
            defaultValue={task.projectId ?? ""}
          >
            <option value="">{t("noProject")}</option>
            {projects
              .filter((p) => !p.archivedAt || p.id === task.projectId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="label">{t("notes")}</span>
        <textarea
          name="notes"
          className="textarea"
          defaultValue={task.notes ?? ""}
          maxLength={4000}
          rows={3}
          dir="auto"
        />
      </label>
      <div className="dialog-actions board-details-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            if (await board.update(task.id, { status: "archived" })) onClose();
          }}
        >
          {t("archive")}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm text-danger"
          onClick={async () => {
            if (!window.confirm(t("deleteConfirm"))) return;
            onClose();
            await board.remove(task.id);
          }}
        >
          {t("delete")}
        </button>
        <span className="flex-1" />
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {tasksT("close")}
        </button>
        <button className="btn btn-primary">{t("save")}</button>
      </div>
    </form>
  );
}

/** Projects and the Incoming filter by project or tag. */
export function ProjectsDialog({
  open,
  onClose,
  projects,
  setProjects,
  tags,
  filter,
  onFilter,
}: {
  open: boolean;
  onClose: () => void;
  projects: ClientProject[];
  setProjects: React.Dispatch<React.SetStateAction<ClientProject[]>>;
  tags: string[];
  filter: IncomingFilter;
  onFilter: (filter: IncomingFilter) => void;
}) {
  const t = useTranslations("tasks.projects");
  const errors = useTranslations("tasks.errors");
  const [name, setName] = useState("");

  async function request(url: string, method: string, body: unknown) {
    try {
      return (await projectRequest(url, method, body)) as ClientProject;
    } catch {
      toast(errors("generic"), "error");
      return null;
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("title")}
      labelledBy="projects-title"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span className="label">{t("filterProject")}</span>
          <select
            className="select"
            value={filter.projectId}
            onChange={(e) => onFilter({ ...filter, projectId: e.target.value })}
          >
            <option value="">{t("all")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{t("filterTag")}</span>
          <select
            className="select"
            value={filter.tag}
            onChange={(e) => onFilter({ ...filter, tag: e.target.value })}
          >
            <option value="">{t("all")}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </label>
      </div>
      {projects.length > 0 && (
        <ul
          className="flex flex-wrap gap-2"
          style={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          {projects.map((p) => (
            <li
              key={p.id}
              className={p.archivedAt ? "badge" : "badge badge-accent"}
            >
              <span dir="auto">{p.name}</span>
              <button
                type="button"
                className="link tiny"
                onClick={async () => {
                  const row = await request(`/api/projects/${p.id}`, "PATCH", {
                    archived: !p.archivedAt,
                  });
                  if (row)
                    setProjects((list) =>
                      list.map((x) => (x.id === p.id ? row : x)),
                    );
                }}
              >
                {p.archivedAt ? t("restore") : t("archive")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const row = await request("/api/projects", "POST", {
            name: name.trim(),
            color: "#2F6F62",
          });
          if (row) {
            setProjects((list) => [...list, row]);
            setName("");
          }
        }}
      >
        <input
          className="input"
          style={{ maxWidth: 260 }}
          value={name}
          maxLength={60}
          aria-label={t("name")}
          placeholder={t("name")}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-secondary">{t("add")}</button>
      </form>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {t("done")}
        </button>
      </div>
    </Dialog>
  );
}
