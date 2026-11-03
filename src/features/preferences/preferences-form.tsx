"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Trash2 } from "lucide-react";
import { toast } from "@/src/components/ui/toast";
import { Switch } from "@/src/components/ui/switch";
import { LanguageSelect } from "@/src/components/language-select";
import { ThemeSelect } from "@/src/components/theme-select";
import { useRouter } from "@/src/i18n/navigation";
import { TIME_TECHNIQUES } from "@/src/features/techniques/slugs";
import { POMODORO_LIMITS, TIMEBOX_LIMITS } from "@/src/features/timer/limits";
import { durationsFor, timeboxMinutes } from "@/src/features/timer/configs";
import { DurationFields } from "@/src/features/focus/duration-fields";
import {
  PushOptIn,
  pushSupported,
  unsubscribeFromPush,
} from "@/src/features/notifications/push-opt-in";
import type {
  CustomPreset,
  TechniqueSettings,
  WorkHours,
} from "@/src/lib/db/json-types";
import { useHydrated } from "@/src/lib/use-hydrated";
import type { PreferencesPatch } from "./schema";

export type PreferencesValues = {
  timezone: string;
  weekStartsOn: number;
  weeklyFocusGoalMinutes: number;
  defaultTimeTechnique: string;
  defaultLearningMethod: string;
  techniqueSettings: TechniqueSettings;
  customPresets: CustomPreset[];
  reviewSteps: number[];
  dailyReminderTime: string;
  emailReviews: boolean;
  emailWeekly: boolean;
  streakNudge: boolean;
  workHours: WorkHours;
};

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "0"] as const;

async function save(patch: PreferencesPatch) {
  const response = await fetch("/api/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return response.ok;
}

export function PreferencesForm({
  initial,
  labels,
  pro,
  vapidPublicKey,
  locale,
}: {
  initial: PreferencesValues;
  labels: Record<string, { name: string }>;
  pro: boolean;
  vapidPublicKey?: string;
  locale: string;
}) {
  const t = useTranslations("settings.prefs");
  const common = useTranslations("common");
  const theme = useTranslations("common.theme");
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [initial.timezone];
    }
  }, [initial.timezone]);
  const weekdayName = (day: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 10, 1 + Number(day))));
  const stepsValid =
    v.reviewSteps.length === 3 &&
    v.reviewSteps[0] >= 1 &&
    v.reviewSteps[0] < v.reviewSteps[1] &&
    v.reviewSteps[1] < v.reviewSteps[2] &&
    v.reviewSteps[2] <= 365;

  async function submit(section: string, patch: PreferencesPatch) {
    setBusy(section);
    const ok = await save(patch);
    setBusy(null);
    toast(ok ? t("saved") : common("status.error"), ok ? "info" : "error");
    if (ok) router.refresh();
  }
  const saveButton = (
    section: string,
    patch: () => PreferencesPatch,
    disabled = false,
  ) => (
    <div>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={busy === section || disabled}
        onClick={() => void submit(section, patch())}
      >
        {busy === section ? common("actions.saving") : common("actions.save")}
      </button>
    </div>
  );

  return (
    <div className="stack">
      <section className="card stack" aria-labelledby="prefs-general">
        <h2 id="prefs-general" className="card-title">
          {t("general")}
        </h2>
        <div className="grid-2">
          <LanguageSelect showLabel />
          <div className="field">
            <span className="label">{theme("label")}</span>
            <ThemeSelect />
          </div>
          <label className="field">
            <span className="label">{t("timezone")}</span>
            <select
              className="select"
              value={v.timezone}
              onChange={(e) => setV({ ...v, timezone: e.target.value })}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            {hydrated &&
              Intl.DateTimeFormat().resolvedOptions().timeZone !==
                v.timezone && (
                <button
                  type="button"
                  className="link tiny self-start"
                  onClick={() =>
                    setV({
                      ...v,
                      timezone:
                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })
                  }
                >
                  {t("useDeviceZone", {
                    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  })}
                </button>
              )}
          </label>
          <label className="field">
            <span className="label">{t("weekStart")}</span>
            <select
              className="select"
              value={v.weekStartsOn}
              onChange={(e) =>
                setV({ ...v, weekStartsOn: Number(e.target.value) })
              }
            >
              {[1, 0, 6].map((day) => (
                <option key={day} value={day}>
                  {weekdayName(String(day))}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">{t("weeklyGoal")}</span>
            <input
              className="input tabular"
              type="number"
              min={0}
              max={168}
              step={0.5}
              value={v.weeklyFocusGoalMinutes / 60}
              onChange={(e) =>
                setV({
                  ...v,
                  weeklyFocusGoalMinutes: Math.round(
                    Math.min(168, Math.max(0, Number(e.target.value) || 0)) *
                      60,
                  ),
                })
              }
            />
            <span className="hint">{t("weeklyGoalHint")}</span>
          </label>
        </div>
        {saveButton("general", () => ({
          timezone: v.timezone,
          weekStartsOn: v.weekStartsOn,
          weeklyFocusGoalMinutes: v.weeklyFocusGoalMinutes,
        }))}
      </section>

      <section className="card stack" aria-labelledby="prefs-techniques">
        <h2 id="prefs-techniques" className="card-title">
          {t("techniques")}
        </h2>
        <div className="grid-2">
          <label className="field">
            <span className="label">{t("defaultTime")}</span>
            <select
              className="select"
              value={v.defaultTimeTechnique}
              onChange={(e) =>
                setV({ ...v, defaultTimeTechnique: e.target.value })
              }
            >
              {TIME_TECHNIQUES.map((slug) => (
                <option key={slug} value={slug}>
                  {labels[slug]?.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">{labels.pomodoro?.name}</span>
          <DurationFields
            value={durationsFor("pomodoro", v.techniqueSettings)!}
            limits={POMODORO_LIMITS}
            onChange={(pomodoro) =>
              setV({
                ...v,
                techniqueSettings: { ...v.techniqueSettings, pomodoro },
              })
            }
          />
        </div>
        <label className="field" style={{ maxWidth: 240 }}>
          <span className="label">{t("timebox")}</span>
          <input
            className="input tabular"
            type="number"
            min={TIMEBOX_LIMITS.min}
            max={TIMEBOX_LIMITS.max}
            value={timeboxMinutes(v.techniqueSettings)}
            onChange={(e) =>
              setV({
                ...v,
                techniqueSettings: {
                  ...v.techniqueSettings,
                  timeboxing: {
                    boxMinutes: Math.min(
                      TIMEBOX_LIMITS.max,
                      Math.max(
                        TIMEBOX_LIMITS.min,
                        Number(e.target.value) || TIMEBOX_LIMITS.min,
                      ),
                    ),
                  },
                },
              })
            }
          />
        </label>
        {v.customPresets.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="label">{t("presets")}</span>
            <ul className="list">
              {v.customPresets.map((preset) => (
                <li key={preset.id} className="small">
                  <span className="flex-1" dir="auto">
                    {preset.name}
                  </span>
                  <span className="muted tabular ltr-island">
                    {preset.work}/{preset.shortBreak}/{preset.longBreak} ×
                    {preset.cycles}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label={t("deletePreset", { name: preset.name })}
                    onClick={() =>
                      setV({
                        ...v,
                        customPresets: v.customPresets.filter(
                          (p) => p.id !== preset.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {saveButton("techniques", () => ({
          defaultTimeTechnique:
            v.defaultTimeTechnique as PreferencesPatch["defaultTimeTechnique"],
          defaultLearningMethod:
            v.defaultLearningMethod as PreferencesPatch["defaultLearningMethod"],
          techniqueSettings:
            v.techniqueSettings as PreferencesPatch["techniqueSettings"],
          customPresets: v.customPresets,
        }))}
      </section>

      <section className="card stack" aria-labelledby="prefs-reviews">
        <h2 id="prefs-reviews" className="card-title">
          {t("reviewSteps")}
        </h2>
        <p className="small muted">{t("reviewStepsText")}</p>
        <div className="flex flex-wrap items-end gap-3">
          {[0, 1, 2].map((i) => (
            <label key={i} className="field" style={{ width: 110 }}>
              <span className="label tiny">{t("stepN", { n: i + 1 })}</span>
              <input
                className="input tabular"
                type="number"
                min={1}
                max={365}
                value={v.reviewSteps[i]}
                aria-invalid={!stepsValid}
                onChange={(e) =>
                  setV({
                    ...v,
                    reviewSteps: v.reviewSteps.map((s, j) =>
                      j === i ? Number(e.target.value) : s,
                    ),
                  })
                }
              />
            </label>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setV({ ...v, reviewSteps: [5, 10, 30] })}
          >
            {t("resetSteps")}
          </button>
        </div>
        {!stepsValid && <p className="error-text">{t("stepsInvalid")}</p>}
        {saveButton(
          "reviews",
          () => ({ reviewSteps: v.reviewSteps as [number, number, number] }),
          !stepsValid,
        )}
      </section>

      <section className="card stack" aria-labelledby="prefs-notifications">
        <h2 id="prefs-notifications" className="card-title">
          {t("notifications")}
        </h2>
        <label className="field" style={{ maxWidth: 220 }}>
          <span className="label">{t("reminderTime")}</span>
          <input
            className="input tabular"
            type="time"
            value={v.dailyReminderTime}
            onChange={(e) => setV({ ...v, dailyReminderTime: e.target.value })}
          />
          <span className="hint">{t("reminderTimeHint")}</span>
        </label>
        {(
          [
            ["emailReviews", t("emailReviews"), t("emailReviewsHint")],
            [
              "emailWeekly",
              t("emailWeekly"),
              pro ? t("emailWeeklyHint") : t("emailWeeklyPro"),
            ],
            ["streakNudge", t("streakNudge"), t("streakNudgeHint")],
          ] as const
        ).map(([key, label, hint]) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div>
              <p className="label">{label}</p>
              <p className="hint">{hint}</p>
            </div>
            <Switch
              label={label}
              checked={v[key]}
              onChange={(checked) => setV({ ...v, [key]: checked })}
            />
          </div>
        ))}
        <div className="stack" style={{ gap: 6 }}>
          <p className="label">{t("browser")}</p>
          <p className="hint">{t("browserHint")}</p>
          {hydrated && vapidPublicKey && pushSupported() ? (
            <div className="flex flex-wrap gap-2">
              <PushOptIn vapidPublicKey={vapidPublicKey} variant="inline" />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  void unsubscribeFromPush().then(() => toast(t("browserOff")))
                }
              >
                {t("browserDisable")}
              </button>
            </div>
          ) : (
            <p className="hint">{t("browserUnavailable")}</p>
          )}
        </div>
        <fieldset className="stack" style={{ gap: 8 }}>
          <legend className="label">{t("hours")}</legend>
          <p className="hint">{t("hoursHint")}</p>
          {WEEKDAYS.map((day) => {
            const window = v.workHours[day];
            return (
              <div key={day} className="flex flex-wrap items-center gap-2">
                <span className="small" style={{ minWidth: 110 }}>
                  {weekdayName(day)}
                </span>
                <Switch
                  label={weekdayName(day)}
                  checked={Boolean(window)}
                  onChange={(on) =>
                    setV({
                      ...v,
                      workHours: {
                        ...v.workHours,
                        [day]: on ? { start: "08:00", end: "21:00" } : null,
                      },
                    })
                  }
                />
                {window && (
                  <span className="flex items-center gap-1 ltr-island">
                    <input
                      className="input select-sm tabular"
                      type="time"
                      aria-label={t("from", { day: weekdayName(day) })}
                      value={window.start}
                      onChange={(e) =>
                        setV({
                          ...v,
                          workHours: {
                            ...v.workHours,
                            [day]: { ...window, start: e.target.value },
                          },
                        })
                      }
                    />
                    <span aria-hidden="true">–</span>
                    <input
                      className="input select-sm tabular"
                      type="time"
                      aria-label={t("to", { day: weekdayName(day) })}
                      value={window.end}
                      onChange={(e) =>
                        setV({
                          ...v,
                          workHours: {
                            ...v.workHours,
                            [day]: { ...window, end: e.target.value },
                          },
                        })
                      }
                    />
                  </span>
                )}
              </div>
            );
          })}
        </fieldset>
        {saveButton("notifications", () => ({
          dailyReminderTime: v.dailyReminderTime,
          emailReviews: v.emailReviews,
          emailWeekly: v.emailWeekly,
          streakNudge: v.streakNudge,
          workHours: v.workHours,
        }))}
      </section>

      <section className="card stack" aria-labelledby="prefs-export">
        <h2 id="prefs-export" className="card-title">
          {t("export")}
        </h2>
        <p className="small muted">{t("exportText")}</p>
        <div className="flex flex-wrap gap-2">
          <a
            className="btn btn-secondary btn-sm"
            href="/api/export?format=json"
            download
          >
            <Download size={15} aria-hidden="true" />
            {t("exportJson")}
          </a>
          {(["sessions", "cards", "reviews"] as const).map((type) => (
            <a
              key={type}
              className="btn btn-ghost btn-sm"
              href={`/api/export?format=csv&type=${type}`}
              download
            >
              <Download size={15} aria-hidden="true" />
              {t(`exportCsv.${type}`)}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
