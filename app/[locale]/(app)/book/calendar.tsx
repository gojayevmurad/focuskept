"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Users,
  UsersRound,
} from "lucide-react";
import { Link, useRouter } from "@/src/i18n/navigation";
import { bookSlot, cancel, joinGroup, type ActionResult } from "./actions";

type Demand = Record<number, number>;
export type CalendarData = {
  timeZone: string;
  now: string;
  days: {
    key: string;
    start: string;
    slots: { at: string; demand: Demand; popular: boolean }[];
  }[];
  mine: {
    id: string;
    startAt: string;
    durationMin: number;
    status: string;
    kind: string;
    sessionId: string | null;
    partner: string | null;
  }[];
  groups: {
    id: string;
    startAt: string;
    durationMin: number;
    title: string | null;
    taken: number;
    capacity: number;
    hostName: string | null;
    joined: boolean;
  }[];
  favorites: { username: string; displayName: string }[];
  plan: "free" | "plus";
  billingEnabled: boolean;
  usage: { used: number; limit: number } | null;
  prefill: {
    start: string | null;
    partner: string | null;
    duration: number | null;
  };
  prevWeek: string | null;
  nextWeek: string;
};

const DURATIONS = [25, 50, 75] as const;
const CUTOFF_MS = 2 * 60_000;

function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia("(max-width: 760px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia("(max-width: 760px)").matches,
    () => false,
  );
}

type Selection =
  | { type: "slot"; at: string }
  | { type: "mine"; id: string }
  | { type: "group"; id: string }
  | null;

export function Calendar({ data }: { data: CalendarData }) {
  const t = useTranslations("book");
  const c = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const narrow = useNarrow();
  const [duration, setDuration] = useState<number>(data.prefill.duration ?? 50);
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<Selection>(
    data.prefill.start
      ? { type: "slot", at: new Date(data.prefill.start).toISOString() }
      : null,
  );
  const [partner, setPartner] = useState(data.prefill.partner ?? "");
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(
    null,
  );
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const now = new Date(data.now).getTime();

  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);

  // Start the grid at the current hour this week, or 8:00 for later weeks.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: data.timeZone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date()),
    );
    const thisWeek = new Date(data.days[0].start).getTime() <= Date.now();
    el.scrollTop = (thisWeek ? Math.max(0, hour - 1) : 8) * 88;
  }, [data.timeZone, data.days, narrow]);

  const mineByStart = useMemo(() => {
    const map = new Map<string, CalendarData["mine"][number]>();
    for (const b of data.mine) map.set(new Date(b.startAt).toISOString(), b);
    return map;
  }, [data.mine]);
  const busyUntil = useMemo(
    () =>
      data.mine.map((b) => ({
        from: new Date(b.startAt).getTime(),
        to: new Date(b.startAt).getTime() + b.durationMin * 60_000,
      })),
    [data.mine],
  );
  const groupsByStart = useMemo(() => {
    const map = new Map<string, CalendarData["groups"]>();
    for (const g of data.groups) {
      const k = new Date(g.startAt).toISOString();
      map.set(k, [...(map.get(k) ?? []), g]);
    }
    return map;
  }, [data.groups]);

  const time = (iso: string) =>
    format.dateTime(new Date(iso), {
      timeZone: data.timeZone,
      hour: "numeric",
      minute: "2-digit",
    });
  const longWhen = (iso: string) =>
    format.dateTime(new Date(iso), {
      timeZone: data.timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const errorText = (r: Extract<ActionResult, { ok: false }>) =>
    t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : c("somethingWrong");

  function run(action: () => Promise<ActionResult>, success: string) {
    setMessage(null);
    start(async () => {
      const result = await action();
      if (result.ok) {
        setSelected(null);
        setMessage({ text: success, ok: true });
        router.refresh();
      } else setMessage({ text: errorText(result) });
    });
  }

  const days = narrow ? data.days.slice(dayIndex, dayIndex + 1) : data.days;
  const rows = data.days[0].slots.length
    ? Math.max(...data.days.map((d) => d.slots.length))
    : 48;
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: data.timeZone,
  }).format(new Date());

  const selectedSlot = selected?.type === "slot" ? selected.at : null;
  const selectedMine =
    selected?.type === "mine"
      ? data.mine.find((b) => b.id === selected.id)
      : null;
  const selectedGroup =
    selected?.type === "group"
      ? data.groups.find((g) => g.id === selected.id)
      : null;
  const waitingAt = (at: string) =>
    data.days.flatMap((d) => d.slots).find((s) => s.at === at)?.demand[
      duration
    ] ?? 0;
  const limitReached = Boolean(
    data.usage && data.usage.used >= data.usage.limit,
  );

  return (
    <div className="stack">
      <div className="row-between">
        <div className="page-title">
          <h1>{t("title")}</h1>
          <p className="muted">
            {t("lead", { zone: data.timeZone.replaceAll("_", " ") })}
          </p>
        </div>
        {data.usage && data.billingEnabled && (
          <span className={`badge ${limitReached ? "warm" : ""}`}>
            {t("usage", {
              used: Math.min(data.usage.used, data.usage.limit),
              limit: data.usage.limit,
            })}
          </span>
        )}
      </div>

      <div className="cal-toolbar">
        <div className="segmented" role="group" aria-label={t("length")}>
          {DURATIONS.map((d) => (
            <button
              key={d}
              aria-pressed={duration === d}
              onClick={() => setDuration(d)}
            >
              {c("minutes", { count: d })}
            </button>
          ))}
        </div>
        <span className="grow" />
        {narrow ? (
          <div className="row">
            <button
              className="button secondary small icon"
              aria-label={t("prevDay")}
              disabled={dayIndex === 0}
              onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <strong className="small">
              {format.dateTime(new Date(data.days[dayIndex].start), {
                timeZone: data.timeZone,
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </strong>
            <button
              className="button secondary small icon"
              aria-label={t("nextDay")}
              onClick={() =>
                dayIndex < data.days.length - 1
                  ? setDayIndex((i) => i + 1)
                  : router.push(
                      `/book?start=${encodeURIComponent(data.nextWeek)}`,
                    )
              }
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div className="row">
            {data.prevWeek ? (
              <Link
                className="button secondary small icon"
                aria-label={t("prevWeek")}
                href={`/book?start=${encodeURIComponent(data.prevWeek)}`}
              >
                <ChevronLeft size={16} />
              </Link>
            ) : (
              <button
                className="button secondary small icon"
                aria-label={t("prevWeek")}
                disabled
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <Link className="button secondary small" href="/book">
              {t("today")}
            </Link>
            <Link
              className="button secondary small icon"
              aria-label={t("nextWeek")}
              href={`/book?start=${encodeURIComponent(data.nextWeek)}`}
            >
              <ChevronRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {message && !selected && (
        <p className={`notice ${message.ok ? "ok" : "error"}`} role="status">
          {message.text}
        </p>
      )}

      <div
        className="cal"
        style={{
          ["--days" as string]: days.length,
          gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="cal-head" />
        {days.map((d) => (
          <div
            key={d.key}
            className={`cal-head ${d.key === todayKey ? "today" : ""}`}
          >
            {format.dateTime(new Date(d.start), {
              timeZone: data.timeZone,
              weekday: "short",
            })}
            <strong>
              {format.dateTime(new Date(d.start), {
                timeZone: data.timeZone,
                day: "numeric",
              })}
            </strong>
          </div>
        ))}
        <div
          className="cal-scroll"
          ref={scroller}
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: rows }).map((_, row) => (
            <Row
              key={row}
              row={row}
              days={days}
              now={now}
              duration={duration}
              mineByStart={mineByStart}
              busyUntil={busyUntil}
              groupsByStart={groupsByStart}
              time={time}
              onSelect={setSelected}
              t={t}
            />
          ))}
        </div>
      </div>

      <div className="legend">
        <span>
          <i
            style={{
              background:
                "color-mix(in srgb, var(--warm-soft), transparent 45%)",
              border: "1px solid var(--line)",
            }}
          />
          {t("legendPopular")}
        </span>
        <span>
          <Users size={12} /> {t("legendWaiting")}
        </span>
        <span>
          <i style={{ background: "var(--accent)" }} />
          {t("legendMine")}
        </span>
        <span>
          <i style={{ background: "var(--warm)" }} />
          {t("legendGroup")}
        </span>
      </div>

      <dialog ref={dialog} className="dialog" onClose={() => setSelected(null)}>
        <div className="dialog-body">
          {selectedSlot && (
            <>
              <div className="stack-sm">
                <span className="overline">{t("newBooking")}</span>
                <h2>{longWhen(selectedSlot)}</h2>
                <p className="muted">
                  {waitingAt(selectedSlot) > 0
                    ? t("waitingCount", { count: waitingAt(selectedSlot) })
                    : t("nobodyYet")}
                </p>
              </div>
              <div className="segmented" role="group" aria-label={t("length")}>
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    aria-pressed={duration === d}
                    onClick={() => setDuration(d)}
                  >
                    {c("minutes", { count: d })}
                  </button>
                ))}
              </div>
              {data.favorites.length > 0 || partner ? (
                <label className="field">
                  {t("with")}
                  <select
                    value={partner}
                    onChange={(e) => setPartner(e.target.value)}
                  >
                    <option value="">{t("anyone")}</option>
                    {partner &&
                      !data.favorites.some((f) => f.username === partner) && (
                        <option value={partner}>@{partner}</option>
                      )}
                    {data.favorites.map((f) => (
                      <option key={f.username} value={f.username}>
                        {f.displayName} (@{f.username})
                      </option>
                    ))}
                  </select>
                  {partner && <small>{t("directHint")}</small>}
                </label>
              ) : null}
              {limitReached && data.billingEnabled ? (
                <p className="notice warn">
                  {t("errors.limit")}{" "}
                  <Link href="/pricing" className="link">
                    {c("upgrade")}
                  </Link>
                </p>
              ) : (
                <p className="small faint">{t("policy")}</p>
              )}
              {message && !message.ok && (
                <p className="notice error">{message.text}</p>
              )}
              <div className="dialog-actions">
                <button
                  className="button secondary"
                  onClick={() => setSelected(null)}
                >
                  {c("cancel")}
                </button>
                <button
                  className="button"
                  disabled={pending || (limitReached && data.billingEnabled)}
                  onClick={() =>
                    run(
                      () =>
                        bookSlot({
                          startAt: selectedSlot,
                          duration,
                          partner: partner || undefined,
                        }),
                      t("booked"),
                    )
                  }
                >
                  {pending && <LoaderCircle size={16} className="spin" />}
                  {t("confirm", { duration })}
                </button>
              </div>
            </>
          )}
          {selectedMine && (
            <>
              <div className="stack-sm">
                <span className="overline">{t("yourSession")}</span>
                <h2>{longWhen(selectedMine.startAt)}</h2>
                <p className="muted">
                  {c("minutes", { count: selectedMine.durationMin })} ·{" "}
                  {selectedMine.status === "matched"
                    ? selectedMine.kind === "group"
                      ? t("groupSeat")
                      : t("matchedWith", { name: selectedMine.partner ?? "" })
                    : t("waitingForMatch")}
                </p>
              </div>
              <p className="small faint">
                {new Date(selectedMine.startAt).getTime() - now >= 3600_000
                  ? t("freeCancel")
                  : t("lateCancel")}
              </p>
              {message && !message.ok && (
                <p className="notice error">{message.text}</p>
              )}
              <div className="dialog-actions">
                {selectedMine.sessionId && (
                  <Link
                    className="button secondary"
                    href={`/session/${selectedMine.sessionId}`}
                  >
                    {t("openRoom")}
                  </Link>
                )}
                <button
                  className="button danger secondary"
                  disabled={pending}
                  onClick={() =>
                    run(() => cancel(selectedMine.id), t("cancelled"))
                  }
                >
                  {t("cancelBooking")}
                </button>
              </div>
            </>
          )}
          {selectedGroup && (
            <>
              <div className="stack-sm">
                <span className="overline">{t("groupSession")}</span>
                <h2>{selectedGroup.title ?? t("groupSession")}</h2>
                <p className="muted">
                  {longWhen(selectedGroup.startAt)} ·{" "}
                  {c("minutes", { count: selectedGroup.durationMin })}
                </p>
                {selectedGroup.hostName && (
                  <p className="small">
                    {t("hostedBy", { name: selectedGroup.hostName })}
                  </p>
                )}
                <p className="small faint">
                  {t("seats", {
                    taken: selectedGroup.taken,
                    capacity: selectedGroup.capacity,
                  })}
                </p>
              </div>
              {message && !message.ok && (
                <p className="notice error">{message.text}</p>
              )}
              <div className="dialog-actions">
                <button
                  className="button secondary"
                  onClick={() => setSelected(null)}
                >
                  {c("close")}
                </button>
                {selectedGroup.joined ? (
                  <Link
                    className="button"
                    href={`/session/${selectedGroup.id}`}
                  >
                    {t("openRoom")}
                  </Link>
                ) : (
                  <button
                    className="button"
                    disabled={
                      pending || selectedGroup.taken >= selectedGroup.capacity
                    }
                    onClick={() =>
                      run(() => joinGroup(selectedGroup.id), t("booked"))
                    }
                  >
                    {t("takeSeat")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}

function Row(props: {
  row: number;
  days: CalendarData["days"];
  now: number;
  duration: number;
  mineByStart: Map<string, CalendarData["mine"][number]>;
  busyUntil: { from: number; to: number }[];
  groupsByStart: Map<string, CalendarData["groups"]>;
  time: (iso: string) => string;
  onSelect: (s: Selection) => void;
  t: ReturnType<typeof useTranslations<"book">>;
}) {
  const reference = props.days.find((d) => d.slots[props.row])?.slots[
    props.row
  ];
  const half = reference
    ? new Date(reference.at).getUTCMinutes() === 30
    : false;
  return (
    <>
      <div className={`cal-time ${half ? "half" : ""}`}>
        {reference ? props.time(reference.at) : ""}
      </div>
      {props.days.map((d) => {
        const slot = d.slots[props.row];
        if (!slot)
          return <div key={d.key} className="slot" aria-hidden="true" />;
        const at = new Date(slot.at).getTime();
        const past = at - props.now < CUTOFF_MS;
        const mine = props.mineByStart.get(slot.at);
        const covered =
          !mine && props.busyUntil.some((b) => at > b.from && at < b.to);
        const groups = props.groupsByStart.get(slot.at) ?? [];
        const waiting = slot.demand[props.duration] ?? 0;
        const label = `${props.time(slot.at)}${waiting ? `, ${props.t("waitingCount", { count: waiting })}` : ""}`;
        return (
          <button
            key={d.key}
            className={`slot ${half ? "half" : ""} ${slot.popular ? "popular" : ""}`}
            disabled={past && !mine}
            aria-label={label}
            onClick={() =>
              mine
                ? props.onSelect({ type: "mine", id: mine.id })
                : groups[0]
                  ? props.onSelect({ type: "group", id: groups[0].id })
                  : covered
                    ? undefined
                    : props.onSelect({ type: "slot", at: slot.at })
            }
          >
            {mine ? (
              <span className={`mine ${mine.kind === "group" ? "group" : ""}`}>
                {mine.status === "matched"
                  ? (mine.partner ?? props.t("groupShort"))
                  : props.t("waitingShort")}{" "}
                · {mine.durationMin}m
              </span>
            ) : groups[0] ? (
              <span className="mine group">
                <UsersRound size={11} />{" "}
                {groups[0].title ?? props.t("groupShort")} {groups[0].taken}/
                {groups[0].capacity}
              </span>
            ) : (
              !past &&
              waiting > 0 && (
                <span className="count">
                  <Users size={11} /> {waiting}
                </span>
              )
            )}
          </button>
        );
      })}
    </>
  );
}
