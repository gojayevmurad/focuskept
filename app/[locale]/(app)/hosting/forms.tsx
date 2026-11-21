// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { apply, cancelHosted, scheduleGroup, type HostState } from "./actions";

function Status({ state }: { state: HostState }) {
  const t = useTranslations("hosting");
  if (state.ok) return <p className="notice ok">{t("done")}</p>;
  if (state.error)
    return (
      <p className="notice error">
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
    for (let i = 0; i < 14 * 48; i++, at += step)
      out.push(new Date(at).toISOString());
    return out;
  }, []);
  const [day, setDay] = useState(options[0].slice(0, 10));
  const days = [
    ...new Set(
      options.map((o) =>
        new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(o)),
      ),
    ),
  ];
  const times = options.filter(
    (o) =>
      new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(o)) ===
      day,
  );
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
          <select name="startAt">
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
            {[3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
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
