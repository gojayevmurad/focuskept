"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Plus,
} from "lucide-react";
import { toast } from "@/src/components/ui/toast";
import { formatMinutes } from "@/src/features/focus/format";
import { addDays, startOfWeek, weekdayOf } from "@/src/lib/dates";
import { eisenhowerFor } from "./planning";
import { parseQuickAdd, wordList } from "./quick-add";
import { projectRequest, type ClientProject } from "./use-tasks";
import type { Board } from "./day-board";

/** Scripts written without spaces: day words match inside the line. */
const UNSPACED = new Set(["ja", "zh-CN"]);
const DURATIONS = [5, 15, 25, 50, 90];
const PROJECT_COLORS = ["#5FC3A8", "#F2B33D", "#9DB4E0", "#E59C8C", "#B9A3E3"];

type Open = "date" | "minutes" | "project" | null;

/** One line plus visible pickers; the typed shortcuts ("45m tomorrow !") still work. */
export function AddBar({
  board,
  projects,
  onProjectCreated,
  weekStartsOn,
}: {
  board: Board;
  projects: ClientProject[];
  onProjectCreated: (project: ClientProject) => void;
  weekStartsOn: number;
}) {
  const t = useTranslations("tasks");
  const locale = useLocale();
  const [text, setText] = useState("");
  // undefined: not picked, so whatever the text says.
  const [date, setDate] = useState<string | null | undefined>(undefined);
  const [minutes, setMinutes] = useState<number | null | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [important, setImportant] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const input = useRef<HTMLInputElement>(null);

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
  const day =
    date !== undefined
      ? date
      : parsed.when === "today"
        ? board.today
        : parsed.when === "tomorrow"
          ? board.tomorrow
          : null;
  const duration = minutes !== undefined ? minutes : parsed.minutes;
  const isImportant = important || parsed.important;
  const size = day === board.today ? board.slotFor(duration) : undefined;
  const project = projects.find((p) => p.id === projectId) ?? null;
  const dayName = useDayName(board.today, board.tomorrow);

  function reset() {
    setText("");
    setDate(undefined);
    setMinutes(undefined);
    setImportant(false);
    setOpen(null);
    input.current?.focus();
  }

  async function add() {
    if (!ready) return;
    const today = day === board.today ? size : undefined;
    if (day === board.today && !today) toast(t("board.dayFull"), "error");
    const plannedFor = day === board.today && !today ? null : day;
    reset();
    await board.create({
      title: parsed.title,
      estimatedMinutes: duration,
      tags: parsed.tags,
      projectId,
      eisenhower: eisenhowerFor(isImportant, parsed.urgent),
      plannedFor,
      size135: today ?? null,
      isFrogOn: today === "big" ? board.today : null,
      ivyRank: plannedFor === board.tomorrow ? board.nextRank() : null,
    });
  }

  const toggle = (menu: Exclude<Open, null>) =>
    setOpen((current) => (current === menu ? null : menu));
  const close = () => setOpen(null);

  const where = !ready
    ? null
    : day === board.today
      ? size
        ? t(`board.chip.slot.${size}`)
        : t("board.chip.full")
      : day === null
        ? t("incoming.title")
        : null;

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
          ref={input}
          className="board-add-input"
          value={text}
          maxLength={260}
          onChange={(e) => setText(e.target.value)}
          aria-label={t("board.addLabel")}
          placeholder={t("board.addPlaceholder")}
          dir="auto"
        />
        <button className="btn btn-inverse btn-sm" disabled={!ready}>
          {t("board.add")}
        </button>
      </div>
      <div className="board-tools">
        <Picker
          open={open === "date"}
          onToggle={() => toggle("date")}
          onClose={close}
          active={day !== null}
          icon={<CalendarDays size={15} aria-hidden="true" />}
          label={day === null ? t("board.date.label") : dayName(day)}
          panelLabel={t("board.date.label")}
        >
          <DatePanel
            today={board.today}
            weekStartsOn={weekStartsOn}
            selected={day}
            onPick={(value) => {
              setDate(value);
              close();
            }}
          />
        </Picker>
        <Picker
          open={open === "minutes"}
          onToggle={() => toggle("minutes")}
          onClose={close}
          active={duration !== null}
          icon={<Clock size={15} aria-hidden="true" />}
          label={
            duration !== null
              ? formatMinutes(duration, locale)
              : t("board.minutes.label")
          }
          panelLabel={t("board.minutes.label")}
        >
          {[...DURATIONS, null].map((value) => (
            <button
              key={value ?? "none"}
              type="button"
              className="picker-option"
              aria-pressed={duration === value}
              onClick={() => {
                setMinutes(value);
                close();
              }}
            >
              {value === null
                ? t("board.minutes.none")
                : formatMinutes(value, locale)}
            </button>
          ))}
        </Picker>
        <Picker
          open={open === "project"}
          onToggle={() => toggle("project")}
          onClose={close}
          active={project !== null}
          icon={
            <span
              className="project-dot"
              style={{ background: project?.color ?? "var(--border-strong)" }}
              aria-hidden="true"
            />
          }
          label={project?.name ?? t("board.project.label")}
          panelLabel={t("board.project.label")}
        >
          <ProjectPanel
            projects={projects}
            selected={projectId}
            onPick={(id) => {
              setProjectId(id);
              close();
            }}
            onCreated={(created) => {
              onProjectCreated(created);
              setProjectId(created.id);
              close();
            }}
          />
        </Picker>
        <button
          type="button"
          className={isImportant ? "picker-chip is-active" : "picker-chip"}
          aria-pressed={isImportant}
          onClick={() => setImportant(!important)}
        >
          <Flag size={15} aria-hidden="true" />
          {t("incoming.important")}
        </button>
        {ready && (
          <span className="board-tools-info" aria-live="polite">
            {[
              where,
              parsed.urgent ? t("incoming.urgent") : null,
              ...parsed.tags.map((tag) => `#${tag}`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </div>
    </form>
  );
}

/** "Today", "Tomorrow" or a short date in the user's language. */
export function useDayName(today: string, tomorrow: string) {
  const t = useTranslations("tasks");
  const locale = useLocale();
  const short = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    [locale],
  );
  return (day: string) =>
    day === today
      ? t("board.chip.today")
      : day === tomorrow
        ? t("board.chip.tomorrow")
        : short.format(new Date(`${day}T12:00:00Z`));
}

function Picker({
  open,
  onToggle,
  onClose,
  active,
  icon,
  label,
  panelLabel,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  panelLabel: string;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        root.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    root.current
      ?.querySelector<HTMLElement>(".picker-panel button, .picker-panel input")
      ?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return (
    <div className="picker" ref={root}>
      <button
        type="button"
        className={active ? "picker-chip is-active" : "picker-chip"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={onToggle}
      >
        {icon}
        {label}
      </button>
      {open && (
        <div className="picker-panel" role="dialog" aria-label={panelLabel}>
          {children}
        </div>
      )}
    </div>
  );
}

function DatePanel({
  today,
  weekStartsOn,
  selected,
  onPick,
}: {
  today: string;
  weekStartsOn: number;
  selected: string | null;
  onPick: (date: string | null) => void;
}) {
  const t = useTranslations("tasks.board.date");
  const locale = useLocale();
  const [month, setMonth] = useState((selected ?? today).slice(0, 7));
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  const weekday = fmt({ weekday: "long" });
  const at = (d: string) => new Date(`${d}T12:00:00Z`);
  const daysUntil = (dow: number) => (dow - weekdayOf(today) + 7) % 7 || 7;
  const saturday = addDays(today, weekdayOf(today) === 6 ? 0 : daysUntil(6));
  const nextWeek = addDays(startOfWeek(today, weekStartsOn), 7);
  const quick: { label: string; date: string | null }[] = [
    { label: t("today"), date: today },
    { label: t("tomorrow"), date: addDays(today, 1) },
    { label: t("weekend"), date: saturday },
    { label: t("nextWeek"), date: nextWeek },
    { label: t("none"), date: null },
  ];

  const first = `${month}-01`;
  const lead = (weekdayOf(first) - weekStartsOn + 7) % 7;
  const [y, m] = month.split("-").map(Number);
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length }, (_, i) => addDays(first, i)),
  ];
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    fmt({ weekday: "narrow" }).format(
      at(addDays(startOfWeek(today, weekStartsOn), i)),
    ),
  );

  return (
    <div className="date-panel">
      <div className="date-quick">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            className="picker-option"
            aria-pressed={selected === q.date}
            onClick={() => onPick(q.date)}
          >
            <span>{q.label}</span>
            {q.date && (
              <span className="picker-hint">{weekday.format(at(q.date))}</span>
            )}
          </button>
        ))}
      </div>
      <div className="date-month">
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => shift(-1)}
          disabled={month <= today.slice(0, 7)}
          aria-label={t("previous")}
        >
          <ChevronLeft size={16} aria-hidden="true" className="rtl-flip" />
        </button>
        <span>{fmt({ month: "long", year: "numeric" }).format(at(first))}</span>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => shift(1)}
          aria-label={t("next")}
        >
          <ChevronRight size={16} aria-hidden="true" className="rtl-flip" />
        </button>
      </div>
      <div className="date-grid">
        {weekdays.map((w, i) => (
          <span key={i} className="date-weekday" aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              className={`date-day${d === today ? " is-today" : ""}`}
              disabled={d < today}
              aria-pressed={selected === d}
              aria-label={fmt({
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(at(d))}
              onClick={() => onPick(d)}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

function ProjectPanel({
  projects,
  selected,
  onPick,
  onCreated,
}: {
  projects: ClientProject[];
  selected: string | null;
  onPick: (id: string | null) => void;
  onCreated: (project: ClientProject) => void;
}) {
  const t = useTranslations("tasks");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const active = projects.filter((p) => !p.archivedAt);

  async function create() {
    const value = name.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const created = (await projectRequest("/api/projects", "POST", {
        name: value,
        color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
      })) as ClientProject;
      setName("");
      onCreated(created);
    } catch {
      toast(t("errors.generic"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {[null, ...active].map((p) => (
        <button
          key={p?.id ?? "none"}
          type="button"
          className="picker-option"
          aria-pressed={selected === (p?.id ?? null)}
          onClick={() => onPick(p?.id ?? null)}
        >
          <span className="picker-option-name">
            <span
              className="project-dot"
              style={{ background: p?.color ?? "var(--border-strong)" }}
              aria-hidden="true"
            />
            {p?.name ?? t("details.noProject")}
          </span>
        </button>
      ))}
      <div className="picker-create">
        <input
          className="input picker-input"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create();
            }
          }}
          placeholder={t("board.project.new")}
          aria-label={t("board.project.new")}
          dir="auto"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!name.trim() || busy}
          onClick={() => void create()}
        >
          {t("board.project.create")}
        </button>
      </div>
    </>
  );
}
