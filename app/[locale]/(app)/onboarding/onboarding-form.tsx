// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { BookOpen, BriefcaseBusiness, PenLine, Palette, ListChecks, Search, Code, Sparkles, Clock, Sun, Sunset, Moon, Sunrise, Check, ArrowLeft, ArrowRight, LoaderCircle, Target, Minus, Plus, Users, Bell, Mail, ChartNoAxesCombined, Megaphone, MessageCircle, Mic, MicOff, type LucideIcon } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { applyAnalyticsPreference } from "@/src/components/analytics-preferences";
import { FOCUS_AREAS, BLOCKERS, PREFERRED_TIMES, computeFocusPlan, validOnboardingStep, type OnboardingProgress, type OnboardingAnswers } from "@/src/lib/profiles/onboarding";
import { HEARD_FROM_OPTIONS } from "@/src/lib/attribution/types";
import { completeOnboarding, saveOnboarding, onboardingSlots } from "./actions";
import styles from "./onboarding.module.css";

type Slot = Awaited<ReturnType<typeof onboardingSlots>>[number];
const AREA_ICONS = [BriefcaseBusiness, BookOpen, PenLine, Palette, ListChecks, Search, Code, Sparkles];
const BLOCKER_ICONS = [Clock, Sparkles, Target, Clock, Users, ListChecks];
const TIME_ICONS = [Sunrise, Sun, Sunset, Moon];
const TITLES = ["welcome", "areas", "blockers", "times", "style", "heard", "plan", "booking", "loop"] as const;

function OptionCard({ value, label, Icon, selected, onChange, multiple = false, group = "choice" }: {
  value: string; label: string; Icon: LucideIcon; selected: boolean; onChange: () => void; multiple?: boolean; group?: string;
}) {
  return <label className={styles.option} data-selected={selected}>
    <input type={multiple ? "checkbox" : "radio"} name={multiple ? value : group} checked={selected} onChange={onChange} />
    <Icon size={22} aria-hidden="true" /><span>{label}</span><Check size={17} className={styles.tick} aria-hidden="true" />
  </label>;
}

export function OnboardingForm({ initial, appName, timezones, analyticsEnabled }: {
  initial: OnboardingProgress; appName: string; timezones: string[]; analyticsEnabled: boolean;
}) {
  const t = useTranslations("onboarding.flow");
  const old = useTranslations("onboarding");
  const c = useTranslations("common");
  const format = useFormatter();
  const [progress, setProgress] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const heading = useRef<HTMLHeadingElement>(null);
  const { step, answers } = progress;
  const plan = computeFocusPlan(answers);
  const zones = [...new Set([answers.timezone, "UTC", ...timezones])];

  useEffect(() => { heading.current?.focus(); }, [step]);

  function persist(next: OnboardingProgress) {
    const save = queue.current.catch(() => {}).then(async () => {
      const result = await saveOnboarding(next);
      if (result.error) throw new Error("save");
    });
    queue.current = save;
    return save;
  }
  function update(patch: Partial<OnboardingAnswers>) {
    const next = { ...progress, answers: { ...answers, ...patch } };
    setProgress(next);
    setError("");
    startTransition(async () => {
      try { await persist(next); } catch { setError(t("saveError")); }
    });
  }
  function move(target: number, patch: Partial<OnboardingAnswers> = {}) {
    if (target > step && !validOnboardingStep(step, answers)) return;
    const next = { ...progress, step: target, answers: { ...answers, ...patch } };
    startTransition(async () => {
      try {
        await persist(next);
        if (target === 7) setSlots(await onboardingSlots(next));
        setProgress(next);
        setError("");
      } catch { setError(t("saveError")); }
    });
  }
  function loadSlots() {
    startTransition(async () => {
      try { setSlots(await onboardingSlots(progress)); setError(""); }
      catch { setError(t("slotsError")); }
    });
  }
  function toggle(key: "focusAreas" | "blockers" | "preferredTimes", value: string) {
    const values: readonly string[] = answers[key];
    update({ [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value], startAt: "" });
  }
  function preference(key: "reminders" | "tips" | "marketing" | "analytics", Icon: LucideIcon) {
    return <label className={styles.preference}>
      <Icon size={22} aria-hidden="true" /><span><strong>{t(`${key}Label`)}</strong><small>{t(`${key}Benefit`)}</small></span>
      <input type="checkbox" role="switch" checked={answers[key]} onChange={(event) => update({ [key]: event.target.checked })} />
    </label>;
  }

  return <form className={styles.flow} onSubmit={(event) => {
    event.preventDefault();
    if (step < 8) { move(step + 1); return; }
    startTransition(async () => {
      try {
        await persist(progress);
        // Same browser key and account consent as Settings; identity stays mounted.
        applyAnalyticsPreference(answers.analytics);
        const form = new FormData(); form.set("progress", JSON.stringify(progress));
        const result = await completeOnboarding({}, form);
        if (result.error) {
          if (result.step !== undefined) setProgress({ ...progress, step: result.step });
          setError(t("saveError"));
        }
      } catch (error) {
        // Next's redirect is handled by the action dispatcher; network errors stay actionable.
        if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
        setError(t("saveError"));
      }
    });
  }}>
    <div className={styles.progress}>
      <span className="small muted">{t("progress", { current: step + 1, total: 9 })}</span>
      <progress max={9} value={step + 1} aria-label={t("progressLabel")} />
    </div>
    <section key={step} className={styles.screen} aria-labelledby="onboarding-heading">
      <header className={styles.heading}>
        <h1 id="onboarding-heading" tabIndex={-1} ref={heading}>{t(`${TITLES[step]}Title`, { name: answers.displayName.trim().split(/\s+/)[0] || appName, app: appName })}</h1>
        <p className="muted">{t(`${TITLES[step]}Lead`)}</p>
      </header>
      {step === 0 && <div className="stack-lg">
        <label className="field">{old("displayName")}<input autoComplete="given-name" value={answers.displayName} onChange={(event) => update({ displayName: event.target.value })} required maxLength={60} placeholder={t("namePlaceholder")} /><small>{old("displayNameHint")}</small></label>
        <label className={styles.legal}><input type="checkbox" checked={answers.age} onChange={(event) => update({ age: event.target.checked })} required /><span>{old("age")}</span></label>
      </div>}
      {step === 1 && <fieldset className={styles.options}><legend className="sr-only">{t("areasTitle")}</legend>{FOCUS_AREAS.map((area, i) => <OptionCard key={area} value={area} label={t(`focusAreas.${area}`)} Icon={AREA_ICONS[i]} selected={answers.focusAreas.includes(area)} onChange={() => toggle("focusAreas", area)} multiple={true} />)}</fieldset>}
      {step === 2 && <fieldset className={styles.options}><legend className="sr-only">{t("blockersTitle")}</legend>{BLOCKERS.map((blocker, i) => <OptionCard key={blocker} value={blocker} label={t(`blockers.${blocker}`)} Icon={BLOCKER_ICONS[i]} selected={answers.blockers.includes(blocker)} onChange={() => toggle("blockers", blocker)} multiple={true} />)}</fieldset>}
      {step === 3 && <div className="stack-lg">
        <p className={styles.reflection}>{t("reflection", { blockers: format.list(answers.blockers.map((blocker) => t(`blockers.${blocker}`))) })} {t(`support.${plan.support}`)}</p>
        <fieldset className={styles.options}><legend className="sr-only">{t("timesTitle")}</legend>{PREFERRED_TIMES.map((time, i) => <OptionCard key={time} value={time} label={t(`preferredTimes.${time}`)} Icon={TIME_ICONS[i]} selected={answers.preferredTimes.includes(time)} onChange={() => toggle("preferredTimes", time)} multiple={true} />)}</fieldset>
        <label className="field">{old("timezone")}<select value={answers.timezone} onChange={(event) => update({ timezone: event.target.value, startAt: "" })}>{zones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}</select><small>{old("timezoneHint")}</small></label>
        <button type="button" className="button secondary" onClick={() => update({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || answers.timezone, startAt: "" })}>{t("detectTimezone")}</button>
      </div>}
      {step === 4 && <div className="stack-lg">
        <fieldset className={styles.group}><legend>{t("durationLabel")}</legend><div className={styles.options}>{([25, 50, 75] as const).map((duration) => <OptionCard key={String(duration)} value={String(duration)} label={c("minutes", { count: duration })} Icon={Clock} selected={answers.duration === duration} onChange={() => update({ duration, startAt: "" })} multiple={false} group={"duration"} />)}</div></fieldset>
        <fieldset className={styles.group}><legend>{t("styleLabel")}</legend><div className={styles.options}>{(["quiet", "chatty"] as const).map((style) => <OptionCard key={style} value={style} label={t(`styles.${style}`)} Icon={style === "quiet" ? BookOpen : MessageCircle} selected={answers.style === style} onChange={() => update({ style })} multiple={false} group={"style"} />)}</div><p className="small muted">{t("styleHint")}</p></fieldset>
        <fieldset className={styles.group}><legend>{t("micLabel")}</legend><div className={styles.options}>{[false, true].map((microphone) => <OptionCard key={String(microphone)} value={String(microphone)} label={t(microphone ? "micOn" : "micOff")} Icon={microphone ? Mic : MicOff} selected={answers.microphone === microphone} onChange={() => update({ microphone })} multiple={false} group={"microphone"} />)}</div></fieldset>
      </div>}
      {step === 5 && <div className="stack-lg">
        <fieldset className={styles.options}><legend className="sr-only">{old("heardFrom", { app: appName })}</legend>{HEARD_FROM_OPTIONS.map((source) => <OptionCard key={source} value={source} label={old(`heardFromOptions.${source}`)} Icon={MessageCircle} selected={answers.heardFrom === source} onChange={() => update({ heardFrom: source })} />)}</fieldset>
        {answers.heardFrom === "other" && <label className="field">{old("heardFromOther")}<input maxLength={60} value={answers.heardFromOther ?? ""} onChange={(event) => update({ heardFromOther: event.target.value })} /></label>}
        <button type="button" className="button secondary" onClick={() => { update({ heardFrom: undefined, heardFromOther: undefined }); }}>{old("heardFromClear")}</button>
      </div>}
      {step === 6 && <div className="stack-lg">
        <div className={styles.plan}><Target size={32} aria-hidden="true" /><p>{t("planSummary", { count: plan.sessions, minutes: plan.minutes, area: t(`focusAreas.${plan.area}`), times: format.list(plan.times.map((time) => t(`preferredTimes.${time}`))) })}</p><p className="muted">{t(`stylePlan.${plan.style}`)} {t(`support.${plan.support}`)}</p></div>
        <div className={styles.stepper}><label htmlFor="weekly-goal">{t("weeklyGoal")}</label><div><button className="button secondary" type="button" aria-label={t("decreaseGoal")} disabled={answers.weeklyGoal <= 1} onClick={() => update({ weeklyGoal: answers.weeklyGoal - 1 })}><Minus size={18} /></button><input id="weekly-goal" aria-label={t("weeklyGoal")} type="number" inputMode="numeric" min={1} max={10} value={answers.weeklyGoal} onChange={(event) => { const weeklyGoal = Number(event.target.value); if (weeklyGoal >= 1 && weeklyGoal <= 10) update({ weeklyGoal }); }} /><button className="button secondary" type="button" aria-label={t("increaseGoal")} disabled={answers.weeklyGoal >= 10} onClick={() => update({ weeklyGoal: answers.weeklyGoal + 1 })}><Plus size={18} /></button></div></div>
      </div>}
      {step === 7 && <div className="stack-lg">
        <p className="small muted">{c("minutes", { count: answers.duration })} · {answers.timezone.replaceAll("_", " ")}</p>
        {slots === null ? <button type="button" className="button secondary" disabled={pending} onClick={loadSlots}>{t("findSlots")}</button> : slots.length ? <fieldset className={styles.options}><legend className="sr-only">{t("bookingTitle")}</legend>{slots.map((slot) => <OptionCard key={slot.startAt} value={slot.startAt} label={format.dateTime(new Date(slot.startAt), { timeZone: answers.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} Icon={Clock} selected={answers.startAt === slot.startAt} onChange={() => update({ startAt: slot.startAt })} />)}</fieldset> : <p className="muted">{old("noSlots")}</p>}
        <button type="button" className="button secondary" aria-pressed={answers.startAt === ""} onClick={() => move(8, { startAt: "" })}>{t("bookLater")}</button>
        {answers.startAt && <p className="small muted">{t("bookingHint")}</p>}
      </div>}
      {step === 8 && <div className="stack-lg">
        <div className={styles.preferences}>{preference("reminders", Bell)}{preference("tips", Mail)}{preference("marketing", Megaphone)}{analyticsEnabled && preference("analytics", ChartNoAxesCombined)}</div>
        <p className="small muted">{t("pushHint")}</p>
        <p className="small muted">{t("privacyHint")} <Link href="/privacy">{t("privacy")}</Link></p>
      </div>}
    </section>
    {error && <p className="notice error" role="alert">{error}</p>}
    <footer className={styles.footer}>
      {step === 0 ? <Link href="/" className="button secondary"><ArrowLeft size={17} aria-hidden="true" />{c("back")}</Link> : <button type="button" className="button secondary" disabled={pending} onClick={() => move(step - 1)}><ArrowLeft size={17} aria-hidden="true" />{c("back")}</button>}
      <button type="submit" className="button" disabled={pending || !validOnboardingStep(step, answers)}>{pending ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : null}{step === 8 ? t("finish") : t("continue")}<ArrowRight size={17} aria-hidden="true" /></button>
    </footer>
    <p className={styles.saved} role="status">{pending ? t("saving") : error ? "" : t("saved")}</p>
  </form>;
}
