"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Play, Plus } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { Dialog } from "@/src/components/ui/dialog";
import { toast } from "@/src/components/ui/toast";
import { formatMinutes } from "@/src/features/focus/format";
import { SLOTS_135 } from "./schema";
import {
  eisenhowerFor,
  freeSlot,
  sizeForMinutes,
  taskMeta,
  type Size,
} from "./planning";
import { parseQuickAdd, wordList } from "./quick-add";
import { useTasks, type ClientProject, type ClientTask } from "./use-tasks";
import { IncomingPanel, type IncomingFilter } from "./incoming";
import {
  PlanTomorrowDialog,
  ProjectsDialog,
  TaskDetailsDialog,
} from "./board-dialogs";

const IVY_MAX = 6;
/** Scripts written without spaces: day words match inside the line. */
const UNSPACED = new Set(["ja", "zh-CN"]);

export type Board = ReturnType<typeof useBoard>;

/** Board actions on top of the optimistic task store. */
function useBoard(initial: ClientTask[], today: string, tomorrow: string) {
  const t = useTranslations("tasks");
  const store = useTasks(initial);
  const { tasks, update } = store;

  const nextRank = (excludeId?: string) => {
    const ranked = tasks.filter(
      (x) =>
        x.id !== excludeId &&
        x.plannedFor === tomorrow &&
        x.ivyRank !== null &&
        x.status !== "archived",
    ).length;
    return ranked < IVY_MAX ? ranked + 1 : null;
  };

  /** Today, into the slot that suits its duration; false when the day is full. */
  const slotFor = (minutes: number | null, excludeId?: string) =>
    freeSlot(tasks, today, sizeForMinutes(minutes), excludeId);

  const toToday = async (task: ClientTask) => {
    const size = slotFor(task.estimatedMinutes, task.id);
    if (!size) {
      toast(t("board.dayFull"), "error");
      return false;
    }
    return update(task.id, {
      plannedFor: today,
      size135: size,
      ivyRank: null,
      isFrogOn: size === "big" ? today : null,
    });
  };
  const toTomorrow = (task: ClientTask) =>
    update(task.id, {
      plannedFor: tomorrow,
      size135: null,
      isFrogOn: null,
      ivyRank: nextRank(task.id),
    });
  const toIncoming = (task: ClientTask) =>
    update(task.id, {
      plannedFor: null,
      size135: null,
      isFrogOn: null,
      ivyRank: null,
    });
  const setDone = (task: ClientTask, done: boolean) =>
    update(task.id, { status: done ? "done" : "todo" });

  /** Tomorrow's list in this order (Ivy Lee); tasks left out keep the day, lose the rank. */
  const saveTomorrow = async (ids: string[]) => {
    for (const x of tasks)
      if (
        x.plannedFor === tomorrow &&
        x.ivyRank !== null &&
        !ids.includes(x.id)
      )
        await update(x.id, { ivyRank: null });
    for (const [i, id] of ids.entries())
      await update(id, {
        plannedFor: tomorrow,
        ivyRank: i + 1,
        size135: null,
        isFrogOn: null,
      });
  };

  return {
    ...store,
    today,
    tomorrow,
    slotFor,
    nextRank,
    toToday,
    toTomorrow,
    toIncoming,
    setDone,
    saveTomorrow,
  };
}

export function DayBoard({
  initialTasks,
  projects: initialProjects,
  today,
  tomorrow,
}: {
  initialTasks: ClientTask[];
  projects: ClientProject[];
  today: string;
  tomorrow: string;
}) {
  const t = useTranslations("tasks");
  const locale = useLocale();
  const board = useBoard(initialTasks, today, tomorrow);
  const { tasks } = board;
  const [projects, setProjects] = useState(initialProjects);
  const [filter, setFilter] = useState<IncomingFilter>({
    quadrant: null,
    projectId: "",
    tag: "",
  });
  const [details, setDetails] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    "incoming" | "planner" | "projects" | null
  >(null);

  const onToday = tasks.filter(
    (x) => x.plannedFor === today && x.status !== "archived",
  );
  const slots = (size: Size) => onToday.filter((x) => x.size135 === size);
  const big = slots("big")[0] ?? null;
  const overflow = onToday.filter(
    (x) => x.size135 === null && x.status !== "done",
  );
  const minutes = (list: ClientTask[]) =>
    list.reduce((sum, x) => sum + (x.estimatedMinutes ?? 0), 0);
  const plannedMin = minutes(onToday);
  const doneMin = minutes(onToday.filter((x) => x.status === "done"));
  const incomingCount = tasks.filter(
    (x) =>
      (x.status === "todo" || x.status === "doing") && x.plannedFor !== today,
  ).length;

  const dateLine = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T12:00:00Z`));
  const duration = (m: number) => formatMinutes(m, locale);
  const editing = tasks.find((x) => x.id === details) ?? null;
  const tags = useMemo(
    () => [...new Set(tasks.flatMap((x) => x.tags))].sort(),
    [tasks],
  );

  const incoming = (
    <IncomingPanel
      board={board}
      filter={filter}
      onFilter={setFilter}
      onOpenTask={setDetails}
      onPlanTomorrow={() => setDialog("planner")}
      onProjects={() => setDialog("projects")}
    />
  );

  return (
    <div className="board">
      <div className="board-top">
        <div>
          <p className="board-date">{dateLine}</p>
          <h1 className="board-title">{t("board.heading")}</h1>
        </div>
        <div className="board-meter">
          <div className="board-meter-text">
            <span>
              {t("board.progress", {
                done: onToday.filter((x) => x.status === "done").length,
                total: onToday.length,
              })}
            </span>
            <span>
              {plannedMin
                ? t("board.planned", {
                    planned: duration(plannedMin),
                    left: duration(plannedMin - doneMin),
                  })
                : t("board.plannedEmpty")}
            </span>
          </div>
          <div
            className="board-meter-bar"
            role="img"
            aria-label={t("board.barLabel", {
              done: duration(doneMin),
              left: duration(plannedMin - doneMin),
            })}
          >
            <span style={{ flexGrow: doneMin }} className="is-done" />
            <span
              style={{ flexGrow: plannedMin - doneMin || (plannedMin ? 0 : 1) }}
            />
          </div>
        </div>
      </div>

      <QuickAdd board={board} />

      <div className="board-layout">
        <section className="board-main" aria-labelledby="board-heading-first">
          <FirstCard
            task={big}
            board={board}
            onOpen={setDetails}
            duration={duration}
          />

          <SlotHeader
            id="board-medium"
            title={t("board.medium.title")}
            used={slots("medium")}
            total={SLOTS_135.medium}
          />
          <ul className="board-cards" aria-labelledby="board-medium">
            {fill(slots("medium"), SLOTS_135.medium).map((task, i) =>
              task ? (
                <li key={task.id} className="board-card">
                  <TaskLine
                    task={task}
                    board={board}
                    onOpen={setDetails}
                    duration={duration}
                    planning={task.ivyRank ? "ivy-lee" : "1-3-5"}
                    stacked
                  />
                </li>
              ) : (
                <li key={`m${i}`} className="board-card is-empty">
                  {t("board.medium.empty")}
                </li>
              ),
            )}
          </ul>

          <SlotHeader
            id="board-small"
            title={t("board.small.title")}
            used={slots("small")}
            total={SLOTS_135.small}
          />
          <ul className="board-rows" aria-labelledby="board-small">
            {fill(slots("small"), SLOTS_135.small).map((task, i) =>
              task ? (
                <li key={task.id} className="board-row">
                  <TaskLine
                    task={task}
                    board={board}
                    onOpen={setDetails}
                    duration={duration}
                    planning={task.ivyRank ? "ivy-lee" : "1-3-5"}
                  />
                </li>
              ) : (
                <li key={`s${i}`} className="board-row is-empty">
                  <span className="board-check is-empty" aria-hidden="true" />
                  {t("board.small.empty")}
                </li>
              ),
            )}
          </ul>

          {overflow.length > 0 && (
            <section
              className="board-overflow"
              aria-labelledby="board-overflow"
            >
              <h2 id="board-overflow" className="board-h2">
                {t("board.overflow.title")}
              </h2>
              <p className="hint">{t("board.overflow.hint")}</p>
              <ul className="board-rows">
                {overflow.map((task) => (
                  <li key={task.id} className="board-row">
                    <TaskLine
                      task={task}
                      board={board}
                      onOpen={setDetails}
                      duration={duration}
                      planning="ivy-lee"
                      extra={
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => void board.toIncoming(task)}
                          aria-label={t("board.toIncomingLabel", {
                            title: task.title,
                          })}
                        >
                          {t("board.toIncoming")}
                        </button>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="hint board-footnote">{t("board.footnote")}</p>
        </section>

        <aside className="board-aside" aria-label={t("incoming.title")}>
          {incoming}
        </aside>
      </div>

      <button
        type="button"
        className="board-incoming-button"
        onClick={() => setDialog("incoming")}
        aria-haspopup="dialog"
      >
        <span>{t("incoming.title")}</span>
        <span className="board-count">{incomingCount}</span>
      </button>
      <Dialog
        open={dialog === "incoming"}
        onClose={() => setDialog(null)}
        variant="sheet"
        label={t("incoming.title")}
      >
        {incoming}
      </Dialog>

      <PlanTomorrowDialog
        open={dialog === "planner"}
        board={board}
        onClose={() => setDialog(null)}
        duration={duration}
      />
      <ProjectsDialog
        open={dialog === "projects"}
        onClose={() => setDialog(null)}
        projects={projects}
        setProjects={setProjects}
        tags={tags}
        filter={filter}
        onFilter={setFilter}
      />
      <TaskDetailsDialog
        task={editing}
        board={board}
        projects={projects}
        onClose={() => setDetails(null)}
      />
    </div>
  );
}

function fill<T>(list: T[], total: number): (T | null)[] {
  return [...list, ...Array<null>(Math.max(total - list.length, 0)).fill(null)];
}

function SlotHeader({
  id,
  title,
  used,
  total,
}: {
  id: string;
  title: string;
  used: ClientTask[];
  total: number;
}) {
  const t = useTranslations("tasks.board");
  return (
    <div className="board-section-head">
      <h2 id={id} className="board-h2">
        {title}
      </h2>
      <span className="hint">
        {t("slotCount", {
          done: used.filter((x) => x.status === "done").length,
          used: used.length,
          free: Math.max(total - used.length, 0),
        })}
      </span>
    </div>
  );
}

function QuickAdd({ board }: { board: Board }) {
  const t = useTranslations("tasks");
  const locale = useLocale();
  const [text, setText] = useState("");
  const words = useMemo(
    () => ({
      today: wordList(t("board.keywords.today")),
      tomorrow: wordList(t("board.keywords.tomorrow")),
      minutes: wordList(t("board.keywords.minutes")),
      hours: wordList(t("board.keywords.hours")),
    }),
    [t],
  );
  const parsed = parseQuickAdd(text, words, !UNSPACED.has(locale));
  const ready = parsed.title.trim().length > 0;
  const size =
    parsed.when === "today" ? board.slotFor(parsed.minutes) : undefined;

  const chips: { label: string; tone?: "accent" | "amber" }[] = [];
  if (ready) {
    chips.push({
      label:
        parsed.when === "today"
          ? t("board.chip.today")
          : parsed.when === "tomorrow"
            ? t("board.chip.tomorrow")
            : t("incoming.title"),
    });
    if (parsed.minutes)
      chips.push({ label: formatMinutes(parsed.minutes, locale) });
    if (parsed.when === "today")
      chips.push(
        size
          ? { label: t(`board.chip.slot.${size}`), tone: "accent" }
          : { label: t("board.chip.full"), tone: "amber" },
      );
    if (parsed.important)
      chips.push({ label: t("incoming.important"), tone: "accent" });
    if (parsed.urgent)
      chips.push({ label: t("incoming.urgent"), tone: "amber" });
    for (const tag of parsed.tags) chips.push({ label: `#${tag}` });
  }

  async function add() {
    if (!ready) return;
    const today = parsed.when === "today" ? size : undefined;
    if (parsed.when === "today" && !today) toast(t("board.dayFull"), "error");
    setText("");
    await board.create({
      title: parsed.title,
      estimatedMinutes: parsed.minutes,
      tags: parsed.tags,
      eisenhower: eisenhowerFor(parsed.important, parsed.urgent),
      plannedFor: today
        ? board.today
        : parsed.when === "tomorrow"
          ? board.tomorrow
          : null,
      size135: today ?? null,
      isFrogOn: today === "big" ? board.today : null,
      ivyRank: parsed.when === "tomorrow" ? board.nextRank() : null,
    });
  }

  return (
    <form
      className={ready ? "board-add is-ready" : "board-add"}
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <div className="board-add-row">
        <Plus size={20} aria-hidden="true" className="board-add-icon" />
        <input
          className="board-add-input"
          value={text}
          maxLength={260}
          onChange={(e) => setText(e.target.value)}
          aria-label={t("board.addLabel")}
          aria-describedby="board-add-chips"
          placeholder={t("board.addPlaceholder")}
          dir="auto"
        />
        {ready && (
          <button className="btn btn-inverse btn-sm">{t("board.add")}</button>
        )}
      </div>
      <div id="board-add-chips" className="board-chips" aria-live="polite">
        {chips.map((chip, i) => (
          <span
            key={i}
            className={chip.tone ? `board-chip is-${chip.tone}` : "board-chip"}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </form>
  );
}

function FirstCard({
  task,
  board,
  onOpen,
  duration,
}: {
  task: ClientTask | null;
  board: Board;
  onOpen: (id: string) => void;
  duration: (m: number) => string;
}) {
  const t = useTranslations("tasks");
  if (!task)
    return (
      <div className="board-first is-empty">
        <p id="board-heading-first" className="board-eyebrow">
          {t("board.first.label")}
        </p>
        <p>{t("board.first.empty")}</p>
      </div>
    );
  const done = task.status === "done";
  return (
    <article className={done ? "board-first is-done" : "board-first"}>
      <CheckButton task={task} board={board} large />
      <div className="board-first-text">
        <p id="board-heading-first" className="board-eyebrow">
          {t("board.first.label")}
        </p>
        <button
          type="button"
          className="board-first-title"
          onClick={() => onOpen(task.id)}
          aria-label={t("board.edit", { title: task.title })}
          dir="auto"
        >
          {task.title}
        </button>
        <p className="board-meta">{taskMeta(task, duration)}</p>
      </div>
      <div className="board-first-actions">
        {!done && (
          <button
            className="btn btn-secondary"
            onClick={() => void board.toTomorrow(task)}
            aria-label={t("board.toTomorrowLabel", { title: task.title })}
          >
            {t("board.toTomorrow")}
          </button>
        )}
        {!done && (
          <Link
            href={{
              pathname: "/app/focus",
              query: { task: task.id, planning: "eat-the-frog" },
            }}
            className="btn btn-primary btn-lg"
            aria-label={t("focusOn", { title: task.title })}
          >
            <Play size={15} aria-hidden="true" />
            {t("board.focus")}
          </Link>
        )}
      </div>
    </article>
  );
}

function CheckButton({
  task,
  board,
  large,
}: {
  task: ClientTask;
  board: Board;
  large?: boolean;
}) {
  const t = useTranslations("tasks");
  const done = task.status === "done";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={t("markDone", { title: task.title })}
      className={`board-check${done ? " is-done" : ""}${large ? " is-large" : ""}`}
      onClick={() => void board.setDone(task, !done)}
    >
      {done && (
        <Check size={large ? 16 : 13} strokeWidth={3} aria-hidden="true" />
      )}
    </button>
  );
}

function TaskLine({
  task,
  board,
  onOpen,
  duration,
  planning,
  stacked,
  extra,
}: {
  task: ClientTask;
  board: Board;
  onOpen: (id: string) => void;
  duration: (m: number) => string;
  planning: string;
  stacked?: boolean;
  extra?: React.ReactNode;
}) {
  const t = useTranslations("tasks");
  const done = task.status === "done";
  const actions = (
    <span className="board-actions">
      {extra}
      {!done && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => void board.toTomorrow(task)}
          aria-label={t("board.toTomorrowLabel", { title: task.title })}
        >
          {t("board.toTomorrow")}
        </button>
      )}
      {!done && (
        <Link
          href={{ pathname: "/app/focus", query: { task: task.id, planning } }}
          className="btn btn-ghost btn-icon btn-sm board-play"
          aria-label={t("focusOn", { title: task.title })}
        >
          <Play size={14} aria-hidden="true" />
        </Link>
      )}
    </span>
  );
  const title = (
    <button
      type="button"
      className={done ? "board-task-title is-done" : "board-task-title"}
      onClick={() => onOpen(task.id)}
      aria-label={t("board.edit", { title: task.title })}
      dir="auto"
    >
      {task.title}
    </button>
  );
  const info = taskMeta(task, duration);
  return stacked ? (
    <>
      <div className="board-card-top">
        <CheckButton task={task} board={board} />
        <div className="board-card-text">
          {title}
          {info && <span className="board-meta">{info}</span>}
        </div>
      </div>
      <div className="board-card-bottom">{actions}</div>
    </>
  ) : (
    <>
      <CheckButton task={task} board={board} />
      {title}
      {info && <span className="board-meta">{info}</span>}
      {actions}
    </>
  );
}
