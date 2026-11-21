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
import { SEGMENTS } from "@/src/lib/profiles/rules";
import { disableAnalytics, enableAnalytics } from "@/src/lib/analytics/client";
import { saveProfile, savePreferences, type SettingsState } from "./actions";

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

export function ProfileForm(props: {
  displayName: string;
  username: string;
  bio: string;
  goal: string;
  timezone: string;
  avatarUrl: string;
  segments: string[];
  timezones: string[];
}) {
  const t = useTranslations("settings");
  const s = useTranslations("segments");
  const [state, action, pending] = useActionState(saveProfile, {});
  return (
    <form action={action} className="form">
      <div className="grid-2">
        <label className="field">
          {t("displayName")}
          <input
            name="displayName"
            defaultValue={props.displayName}
            required
            maxLength={60}
          />
        </label>
        <label className="field">
          {t("username")}
          <input
            name="username"
            defaultValue={props.username}
            required
            minLength={3}
            maxLength={24}
          />
        </label>
      </div>
      <label className="field">
        {t("bio")}
        <textarea
          name="bio"
          defaultValue={props.bio}
          maxLength={280}
          rows={3}
        />
        <small>{t("bioHint")}</small>
      </label>
      <label className="field">
        {t("goal")}
        <input name="goal" defaultValue={props.goal} maxLength={200} />
      </label>
      <div className="grid-2">
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
        <label className="field">
          {t("avatarUrl")}
          <input
            name="avatarUrl"
            type="url"
            defaultValue={props.avatarUrl}
            placeholder="https://…"
          />
        </label>
      </div>
      <div className="stack-sm">
        <span className="field">{t("segments")}</span>
        <div className="chips">
          {SEGMENTS.map((seg) => (
            <label key={seg} className="chip">
              <input
                type="checkbox"
                name="segments"
                value={seg}
                defaultChecked={props.segments.includes(seg)}
              />
              {s(seg)}
            </label>
          ))}
        </div>
      </div>
      <div className="row">
        <button className="button" disabled={pending}>
          {pending && <LoaderCircle size={16} className="spin" />}
          {t("save")}
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function PreferencesForm(props: {
  emailReminders: boolean;
  pushReminders: boolean;
  microphoneDefault: boolean;
  matchSameSegment: boolean;
  statsPublic: boolean;
  plus: boolean;
  pushPublicKey?: string;
}) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState(savePreferences, {});
  return (
    <form action={action} className="form">
      <label className="check">
        <input
          type="checkbox"
          name="emailReminders"
          defaultChecked={props.emailReminders}
        />
        <span>{t("emailReminders")}</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="pushReminders"
          defaultChecked={props.pushReminders}
        />
        <span>{t("pushReminders")}</span>
      </label>
      {props.pushPublicKey && <PushToggle publicKey={props.pushPublicKey} />}
      <label className="check">
        <input
          type="checkbox"
          name="microphoneDefault"
          defaultChecked={props.microphoneDefault}
        />
        <span>{t("microphoneDefault")}</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="statsPublic"
          defaultChecked={props.statsPublic}
        />
        <span>{t("statsPublic")}</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="matchSameSegment"
          defaultChecked={props.matchSameSegment}
          disabled={!props.plus}
        />
        <span>
          {t("matchSameSegment")}{" "}
          {!props.plus && <span className="badge accent">Plus</span>}
        </span>
      </label>
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

export function AnalyticsChoice() {
  const t = useTranslations("settings");
  const [message, setMessage] = useState("");
  async function set(consent: boolean) {
    const result = await fetch("/api/account/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent }),
    });
    if (!result.ok) return setMessage(t("errors.invalid"));
    try {
      localStorage.setItem("analytics-consent", consent ? "yes" : "no");
    } catch {}
    if (consent) enableAnalytics();
    else disableAnalytics();
    setMessage(consent ? t("analyticsOn") : t("analyticsOff"));
  }
  return (
    <div className="stack-sm">
      <div className="row">
        <button className="button secondary small" onClick={() => set(true)}>
          {t("allowAnalytics")}
        </button>
        <button className="button secondary small" onClick={() => set(false)}>
          {t("denyAnalytics")}
        </button>
      </div>
      {message && (
        <p className="small muted" role="status">
          {message}
        </p>
      )}
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
