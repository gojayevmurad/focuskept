// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import {
  useActionState,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { authClient } from "@/src/lib/auth/client";
import { addTag } from "./tags";
import { PREFERRED_TIMES } from "@/src/lib/profiles/onboarding";
import styles from "./settings.module.css";
import { SEGMENTS } from "@/src/lib/profiles/rules";
import { disableAnalytics, enableAnalytics } from "@/src/lib/analytics/client";
import {
  saveProfile,
  savePreferences,
  checkUsername,
  type SettingsState,
} from "./actions";

function Status({ state }: { state: SettingsState }) {
  const t = useTranslations("settings");
  if (state.ok)
    return (
      <p className="notice ok" role="status">
        {t("saved")}
      </p>
    );
  if (state.error)
    return (
      <p className="notice error" role="status">
        {t.has(`errors.${state.error}`)
          ? t(`errors.${state.error}`)
          : t("errors.invalid")}
      </p>
    );
  return null;
}

export function TagInput({ initial }: { initial: string[] }) {
  const t = useTranslations("settings");
  const labels = useTranslations("segments");
  const [tags, setTags] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  function add(value: string) {
    const next = addTag(tags, value);
    setError(next === tags);
    if (next !== tags) {
      setTags(next);
      setDraft("");
    }
  }
  return (
    <fieldset className={styles.tags}>
      <legend>{t("segments")}</legend>
      <p className="small muted" id="tag-help">
        {t("tagHint")}
      </p>
      <div className="chips">
        {tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            <input type="hidden" name="segments" value={tag} />
            {(SEGMENTS as readonly string[]).includes(tag) ? labels(tag) : tag}
            <button
              type="button"
              aria-label={t("removeTag", { tag })}
              onClick={() => {
                setTags(tags.filter((v) => v !== tag));
                setError(false);
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="row">
        <label className="field">
          {t("customTag")}
          <input
            value={draft}
            placeholder={t("tagPlaceholder")}
            maxLength={24}
            aria-describedby="tag-help"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
          />
        </label>
        <button
          type="button"
          className="button secondary"
          onClick={() => add(draft)}
          disabled={!draft.trim() || tags.length >= 5}
        >
          {t("addTag")}
        </button>
      </div>
      {error && (
        <p className="small" role="status">
          {t("tagError")}
        </p>
      )}
      <div className="chips">
        {SEGMENTS.filter((tag) => !tags.includes(tag)).map((tag) => (
          <button
            className="button secondary small"
            key={tag}
            type="button"
            disabled={tags.length >= 5}
            onClick={() => add(tag)}
          >
            + {labels(tag)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function ProfileForm(props: {
  displayName: string;
  username: string;
  bio: string;
  goal: string;
  timezone: string;
  segments: string[];
  timezones: string[];
}) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState(saveProfile, {});
  const [bio, setBio] = useState(props.bio);
  const [username, setUsername] = useState(props.username);
  const [availability, setAvailability] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void checkUsername(username)
        .then((result) => {
          if (active) setAvailability(result);
        })
        .catch(() => {
          if (active) setAvailability("invalid");
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [username]);
  return (
    <form action={action} className="form">
      <div className="grid-2">
        <label className="field">
          {t("displayName")}
          <input
            name="displayName"
            defaultValue={props.displayName}
            placeholder={t("namePlaceholder")}
            required
            maxLength={60}
            autoComplete="name"
          />
        </label>
        <label className="field">
          {t("username")}
          <input
            name="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setAvailability("");
            }}
            placeholder={t("usernamePlaceholder")}
            required
            minLength={3}
            maxLength={24}
            aria-describedby="username-status"
          />
          <small id="username-status" role="status">
            {availability
              ? availability === "available"
                ? t("usernameAvailable")
                : t(`errors.${availability}`)
              : t("usernameHint")}
          </small>
        </label>
      </div>
      <label className="field">
        {t("bio")}
        <textarea
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t("bioExample1")}
          maxLength={280}
          rows={3}
        />
        <small>
          {t("bioHint")} · {bio.length}/280
        </small>
      </label>
      <div className={styles.examples}>
        {[1, 2, 3].map((n) => (
          <button
            type="button"
            className="button secondary small"
            key={n}
            onClick={() => setBio(t(`bioExample${n}`))}
          >
            {t(`bioExample${n}`)}
          </button>
        ))}
      </div>
      <label className="field">
        {t("goal")}
        <input
          name="goal"
          defaultValue={props.goal}
          placeholder={t("goalPlaceholder")}
          maxLength={200}
        />
      </label>
      <label className="field">
        {t("timezone")}
        <select name="timezone" defaultValue={props.timezone}>
          {props.timezones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <TagInput initial={props.segments} />
      <div className="row">
        <button className="button" disabled={pending}>
          {pending && <LoaderCircle size={16} />}
          {t("save")}
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}
export function PreferencesForm(props: {
  section: "focus" | "notifications" | "privacy";
  analyticsEnabled: boolean;
  analyticsConsent: boolean;
  emailReminders: boolean;
  pushReminders: boolean;
  emailTips: boolean;
  emailMarketing: boolean;
  microphoneDefault: boolean;
  matchSameSegment: boolean;
  statsPublic: boolean;
  plus: boolean;
  pushPublicKey?: string;
  defaultDuration: number;
  preferredTimes: string[];
  weeklyGoal: number;
}) {
  const t = useTranslations("settings");
  const focus = useTranslations("onboarding.flow");
  const c = useTranslations("common");
  const [state, action, pending] = useActionState(savePreferences, {});
  useEffect(() => {
    if (state.ok && state.analyticsConsent !== undefined) {
      try {
        localStorage.setItem(
          "analytics-consent",
          state.analyticsConsent ? "yes" : "no",
        );
      } catch {}
      if (state.analyticsConsent) enableAnalytics();
      else disableAnalytics();
    }
  }, [state]);
  const check = (
    name:
      | "emailReminders"
      | "pushReminders"
      | "emailTips"
      | "emailMarketing"
      | "microphoneDefault"
      | "matchSameSegment"
      | "statsPublic",
    hint?: string,
  ) => (
    <label className="check" key={name}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={props[name]}
        disabled={name === "matchSameSegment" && !props.plus}
      />
      <span>
        {t(name)}
        {name === "matchSameSegment" && !props.plus && (
          <span className="badge accent">Plus</span>
        )}
        {hint && <small className={styles.benefit}>{t(hint)}</small>}
      </span>
    </label>
  );
  return (
    <form action={action} className="form">
      <input type="hidden" name="section" value={props.section} />
      {props.section === "focus" ? (
        <>
          <div className="grid-2">
            <label className="field">
              {t("duration")}
              <select
                name="defaultDuration"
                defaultValue={props.defaultDuration}
              >
                {[25, 50, 75].map((n) => (
                  <option key={n} value={n}>
                    {c("minutes", { count: n })}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t("weeklyGoal")}
              <input
                type="number"
                name="weeklyGoal"
                min={1}
                max={10}
                defaultValue={props.weeklyGoal}
              />
              <small>{t("weeklyGoalHint")}</small>
            </label>
          </div>
          <fieldset className={styles.tags}>
            <legend>{t("preferredTimes")}</legend>
            <div className="chips">
              {PREFERRED_TIMES.map((time) => (
                <label className="chip" key={time}>
                  <input
                    name="preferredTimes"
                    type="checkbox"
                    value={time}
                    defaultChecked={props.preferredTimes.includes(time)}
                  />
                  {focus(`preferredTimes.${time}`)}
                </label>
              ))}
            </div>
          </fieldset>
          {check("microphoneDefault")}
          {check("matchSameSegment")}
        </>
      ) : props.section === "notifications" ? (
        <>
          {check("emailReminders", "reminderBenefit")}
          {check("pushReminders", "pushBenefit")}
          {props.pushPublicKey && (
            <PushToggle publicKey={props.pushPublicKey} />
          )}
          {check("emailTips", "tipsBenefit")}
          {check("emailMarketing", "marketingBenefit")}
        </>
      ) : (
        <>
          {check("statsPublic")}
          {props.analyticsEnabled && (
            <>
              <input type="hidden" name="analyticsEnabled" value="yes" />
              <label className="check">
                <input
                  type="checkbox"
                  name="analyticsConsent"
                  defaultChecked={props.analyticsConsent}
                />
                <span>
                  {t("analytics")}
                  <small className={styles.benefit}>{t("analyticsLead")}</small>
                </span>
              </label>
            </>
          )}
        </>
      )}
      <div className="row">
        <button className="button" disabled={pending}>
          {t("save")}
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

function urlBase64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function PushToggle({ publicKey }: { publicKey: string }) {
  const t = useTranslations("settings");
  const support = useSyncExternalStore(
    () => () => {},
    () =>
      !("serviceWorker" in navigator) || !("PushManager" in window)
        ? "unsupported"
        : Notification.permission === "denied"
          ? "denied"
          : "ok",
    () => "ok",
  );
  const [subscribed, setStatus] = useState<"off" | "on" | "denied">("off");
  useEffect(() => {
    if (support !== "ok") return;
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (reg && (await reg.pushManager.getSubscription())) setStatus("on");
    });
  }, [support]);
  const status = support === "ok" ? subscribed : support;
  async function enable() {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setStatus("denied");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(publicKey),
    });
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setStatus("on");
  }
  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setStatus("off");
  }
  if (status === "unsupported")
    return <p className="small faint">{t("pushUnsupported")}</p>;
  if (status === "denied")
    return <p className="small faint">{t("pushDenied")}</p>;
  return (
    <div className="row">
      <button
        type="button"
        className="button secondary small"
        onClick={status === "on" ? disable : enable}
      >
        {status === "on" ? t("pushDisable") : t("pushEnable")}
      </button>
    </div>
  );
}

export function PasswordForm() {
  const t = useTranslations("settings");
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(
    null,
  );
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const result = await authClient.changePassword({
          currentPassword: String(data.get("current")),
          newPassword: String(data.get("next")),
          revokeOtherSessions: true,
        });
        setMessage(
          result.error
            ? { text: result.error.message || t("errors.invalid") }
            : { text: t("passwordChanged"), ok: true },
        );
      }}
    >
      <div className="grid-2">
        <label className="field">
          {t("currentPassword")}
          <input
            type="password"
            name="current"
            autoComplete="current-password"
            required
          />
        </label>
        <label className="field">
          {t("newPassword")}
          <input
            type="password"
            name="next"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
      </div>
      <div className="row">
        <button className="button secondary">{t("changePassword")}</button>
        <button
          type="button"
          className="button ghost"
          onClick={async () => {
            await authClient.revokeOtherSessions();
            setMessage({ text: t("otherSessionsOut"), ok: true });
          }}
        >
          {t("signOutOthers")}
        </button>
      </div>
      {message && (
        <p className={`notice ${message.ok ? "ok" : "error"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("settings");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (data.get("confirm") !== "DELETE")
          return setMessage(t("typeDelete"));
        setBusy(true);
        const result = await authClient.deleteUser(
          hasPassword
            ? { password: String(data.get("password")), callbackURL: "/" }
            : { callbackURL: "/" },
        );
        setBusy(false);
        if (result.error) setMessage(result.error.message || t("deleteFailed"));
        else window.location.replace(window.location.origin);
      }}
    >
      {hasPassword && (
        <label className="field">
          {t("currentPassword")}
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </label>
      )}
      <label className="field">
        {t("typeDelete")}
        <input name="confirm" autoComplete="off" required />
      </label>
      <div className="row">
        <button className="button danger" disabled={busy}>
          {t("deleteAccount")}
        </button>
      </div>
      {!hasPassword && <p className="small faint">{t("deleteFresh")}</p>}
      {message && <p className="notice error">{message}</p>}
    </form>
  );
}
