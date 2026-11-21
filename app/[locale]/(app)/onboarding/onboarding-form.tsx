// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useActionState, useState, useSyncExternalStore } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { LoaderCircle, Users } from "lucide-react";
import { SEGMENTS } from "@/src/lib/profiles/rules";
import { completeOnboarding, type OnboardingState } from "./actions";

type Slot = { startAt: string; waiting: number; popular: boolean };

export function OnboardingForm(props: {
  displayName: string;
  username: string;
  timezone: string;
  appUrl: string;
  slots: Slot[];
  timezones: string[];
}) {
  const t = useTranslations("onboarding");
  const s = useTranslations("segments");
  const c = useTranslations("common");
  const format = useFormatter();
  const [step, setStep] = useState(1);
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    async (prev, form) => {
      const result = await completeOnboarding(prev, form);
      if (result.error?.startsWith("username") || result.error === "age")
        setStep(1);
      return result;
    },
    {},
  );
  const [username, setUsername] = useState(props.username);
  // The browser knows the real zone; the stored value is only a default.
  const detected = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || props.timezone,
    () => props.timezone,
  );
  const [chosen, setTimezone] = useState<string | null>(null);
  const timezone =
    chosen ??
    (props.timezone === "America/New_York" ? detected : props.timezone);
  const [slot, setSlot] = useState("");
  const [duration, setDuration] = useState(50);

  const errorText =
    state.error === "username_taken"
      ? t("usernameTaken")
      : state.error === "username_format"
        ? t("usernameFormat")
        : state.error === "username_reserved"
          ? t("usernameReserved")
          : state.error
            ? c("somethingWrong")
            : null;
  const zones = props.timezones.includes(timezone)
    ? props.timezones
    : [timezone, ...props.timezones];

  return (
    <form action={action} className="stack-lg">
      <p className="overline">{t("step", { n: step })}</p>
      {errorText && <p className="notice error">{errorText}</p>}

      <section className="card stack" hidden={step !== 1}>
        <div className="stack-sm">
          <h2>{t("aboutTitle")}</h2>
          <p className="muted">{t("aboutLead")}</p>
        </div>
        <label className="field">
          {t("displayName")}
          <input
            name="displayName"
            defaultValue={props.displayName}
            required
            maxLength={60}
          />
          <small>{t("displayNameHint")}</small>
        </label>
        <label className="field">
          {t("username")}
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            required
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9][a-z0-9_\-]{1,22}[a-z0-9]"
          />
          <small>
            {t("usernameHint", {
              url: `${props.appUrl.replace(/^https?:\/\//, "")}/u/${username}`,
            })}
          </small>
        </label>
        <label className="field">
          {t("timezone")}
          <select
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <small>{t("timezoneHint")}</small>
        </label>
        <label className="check">
          <input type="checkbox" name="age" required />
          {t("age")}
        </label>
        <div className="row">
          <button type="button" className="button" onClick={() => setStep(2)}>
            {c("next")}
          </button>
        </div>
      </section>

      <section className="card stack" hidden={step !== 2}>
        <h2>{t("goalTitle")}</h2>
        <label className="field">
          {t("goal")}
          <input
            name="goal"
            maxLength={200}
            placeholder={t("goalPlaceholder")}
          />
        </label>
        <fieldset
          className="stack-sm"
          style={{ border: 0, padding: 0, margin: 0 }}
        >
          <legend className="field" style={{ marginBottom: 8 }}>
            {t("segments")}
          </legend>
          <div className="chips">
            {SEGMENTS.map((seg) => (
              <label key={seg} className="chip">
                <input type="checkbox" name="segments" value={seg} />
                {s(seg)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row">
          <button
            type="button"
            className="button secondary"
            onClick={() => setStep(1)}
          >
            {c("back")}
          </button>
          <button type="button" className="button" onClick={() => setStep(3)}>
            {c("next")}
          </button>
        </div>
      </section>

      <section className="card stack" hidden={step !== 3}>
        <div className="stack-sm">
          <h2>{t("firstTitle")}</h2>
          <p className="muted">{t("firstLead")}</p>
        </div>
        <div className="row">
          <span className="small muted">{t("duration")}</span>
          <div className="segmented" role="group">
            {[25, 50, 75].map((d) => (
              <button
                type="button"
                key={d}
                aria-pressed={duration === d}
                onClick={() => setDuration(d)}
              >
                {c("minutes", { count: d })}
              </button>
            ))}
          </div>
        </div>
        <input type="hidden" name="duration" value={duration} />
        <input type="hidden" name="startAt" value={slot} />
        {props.slots.length ? (
          <div className="chips">
            {props.slots.map((sl) => (
              <button
                type="button"
                key={sl.startAt}
                className="chip"
                aria-pressed={slot === sl.startAt}
                onClick={() => setSlot(slot === sl.startAt ? "" : sl.startAt)}
              >
                {format.dateTime(new Date(sl.startAt), {
                  timeZone: timezone,
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {sl.waiting > 0 && (
                  <span className="badge accent">
                    <Users size={12} /> {sl.waiting}
                  </span>
                )}
                {sl.popular && !sl.waiting && (
                  <span className="badge warm">{t("popular")}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">{t("noSlots")}</p>
        )}
        <div className="row">
          <button
            type="button"
            className="button secondary"
            onClick={() => setStep(2)}
          >
            {c("back")}
          </button>
          <button className="button" disabled={pending}>
            {pending && <LoaderCircle size={16} className="spin" />}
            {slot ? t("finish") : t("skip")}
          </button>
        </div>
      </section>
    </form>
  );
}
