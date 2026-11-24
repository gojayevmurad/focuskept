// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { joinGroup } from "@/app/[locale]/(app)/book/actions";
import { Link } from "@/src/i18n/navigation";
import { apply, cancelHosted, scheduleGroup, type HostState } from "./actions";

function Status({ state }: { state: HostState }) {
  const t = useTranslations("hosting");
  if (state.ok)
    return (
      <p role="status" className="notice ok">
        {t("done")}
      </p>
    );
  if (state.error)
    return (
      <p role="alert" className="notice error">
        {t.has(`errors.${state.error}`)
          ? t(`errors.${state.error}`)
          : t("errors.invalid")}
      </p>
    );
  return null;
}

export function ApplyForm() {
  const t = useTranslations("hosting");
  const [state, action, pending] = useActionState(apply, {});
  return (
    <form action={action} className="form">
      <label className="field">
        {t("pitch")}
        <textarea
          name="pitch"
          required
          minLength={20}
          maxLength={800}
          rows={4}
          placeholder={t("pitchPlaceholder")}
        />
      </label>
      <label className="field">
        {t("audience")}
        <input name="audienceUrl" type="url" placeholder="https://" />
        <small>{t("audienceHint")}</small>
      </label>
      <div className="row">
        <button className="button" disabled={pending}>
          {t("apply")}
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function ScheduleForm({ timeZone }: { timeZone: string }) {
  const t = useTranslations("hosting");
  const format = useFormatter();
  const [state, action, pending] = useActionState(scheduleGroup, {});
  // The next 14 days of half-hour slots, from an hour from now.
  const options = useMemo(() => {
    const out: string[] = [];
    const step = 30 * 60_000;
    let at = Math.ceil((Date.now() + 60 * 60_000) / step) * step;
    for (; at <= Date.now() + 14 * 86400000; at += step)
      out.push(new Date(at).toISOString());
    return out;
  }, []);
  const localDate = (value: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  const [day, setDay] = useState(() => localDate(options[0]));
  const days = [...new Set(options.map(localDate))];
  const times = options.filter((o) => localDate(o) === day);
  return (
    <form action={action} className="form">
      <label className="field">
        {t("sessionTitle")}
        <input
          name="title"
          required
          minLength={3}
          maxLength={80}
          placeholder={t("titlePlaceholder")}
        />
      </label>
      <div className="grid-2">
        <label className="field">
          {t("day")}
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {format.dateTime(new Date(`${d}T12:00:00`), {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("time")}
          <select name="startAt" key={day} required>
            {times.map((o) => (
              <option key={o} value={o}>
                {format.dateTime(new Date(o), {
                  timeZone,
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid-2">
        <label className="field">
          {t("length")}
          <select name="duration" defaultValue="50">
            {[25, 50, 75].map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("capacity")}
          <select name="capacity" defaultValue="9">
            {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <small>{t("capacityHelp")}</small>
        </label>
      </div>
      <p className="small muted">{t("timezoneHelp", { timezone: timeZone })}</p>
      <div className="row">
        <button className="button" disabled={pending}>
          {t("schedule")}
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function CancelHosted({ id }: { id: string }) {
  const t = useTranslations("hosting");
  const [pending, start] = useTransition();
  return (
    <button
      className="button ghost small"
      disabled={pending}
      onClick={() => start(() => cancelHosted(id))}
    >
      {t("cancel")}
    </button>
  );
}

export function JoinHosted({
  id,
  full = false,
}: {
  id: string;
  full?: boolean;
}) {
  const t = useTranslations("hostPage");
  const book = useTranslations("book");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  return (
    <div className="stack-sm">
      {joined ? (
        <Link className="button" href={`/session/${id}`}>
          {t("openSession")}
        </Link>
      ) : (
        <button
          className="button"
          disabled={pending || full}
          onClick={() =>
            start(async () => {
              const result = await joinGroup(id);
              if (result.ok) setJoined(true);
              else setError(result.error);
            })
          }
        >
          {t(full ? "full" : "takeSeat")}
        </button>
      )}
      {error && (
        <p role="alert" className="small">
          {book.has(`errors.${error}`)
            ? book(`errors.${error}`)
            : book("errors.invalid")}
        </p>
      )}
    </div>
  );
}
