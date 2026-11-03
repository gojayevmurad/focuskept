"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { authClient } from "@/src/lib/auth/client";

export function ProfileForm({ name }: { name: string }) {
  const t = useTranslations("settings.account");
  const common = useTranslations("common");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      style={{ maxWidth: 440 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const data = new FormData(e.currentTarget);
        try {
          const result = await authClient.updateUser({
            name: String(data.get("name")).trim(),
          });
          setMessage(result.error ? common("status.error") : t("saved"));
        } catch {
          setMessage(common("status.error"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span className="label">{t("displayName")}</span>
        <input
          className="input"
          name="name"
          defaultValue={name}
          maxLength={80}
          required
        />
      </label>
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? common("actions.saving") : common("actions.save")}
        </button>
      </div>
      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("settings.security");
  const common = useTranslations("common");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      style={{ maxWidth: 440 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const form = e.currentTarget;
        const data = new FormData(form);
        try {
          const result = await authClient.changePassword({
            currentPassword: String(data.get("currentPassword")),
            newPassword: String(data.get("password")),
            revokeOtherSessions: true,
          });
          if (result.error) setMessage(t("passwordError"));
          else {
            setMessage(t("passwordChanged"));
            form.reset();
          }
        } catch {
          setMessage(common("status.error"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span className="label">{t("currentPassword")}</span>
        <input
          className="input"
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
          dir="ltr"
        />
      </label>
      <label className="field">
        <span className="label">{t("newPassword")}</span>
        <input
          className="input"
          type="password"
          name="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          dir="ltr"
        />
        <span className="hint">{t("passwordHint")}</span>
      </label>
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? common("actions.saving") : t("changePassword")}
        </button>
      </div>
      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}
    </form>
  );
}

export function Sessions() {
  const t = useTranslations("settings.security");
  const [message, setMessage] = useState("");
  return (
    <div className="stack">
      <div>
        <button
          className="btn btn-secondary"
          onClick={async () => {
            const result = await authClient.revokeOtherSessions();
            setMessage(result.error ? t("revokeError") : t("revoked"));
          }}
        >
          {t("revokeOthers")}
        </button>
      </div>
      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

export function DeleteAccount({ confirmWord }: { confirmWord: string }) {
  const t = useTranslations("settings.delete");
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <form
      className="stack"
      style={{ maxWidth: 440 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (String(data.get("confirmation")).trim() !== confirmWord) {
          setMessage(t("typeToConfirm", { word: confirmWord }));
          return;
        }
        try {
          const result = await authClient.deleteUser({
            password: String(data.get("password")),
          });
          if (result.error)
            setMessage(
              result.error.status === 403 ? t("billingBlocked") : t("error"),
            );
          else {
            try {
              localStorage.removeItem("focuskept:v1");
            } catch {}
            router.push("/");
            router.refresh();
          }
        } catch {
          setMessage(t("error"));
        }
      }}
    >
      <label className="field">
        <span className="label">{t("password")}</span>
        <input
          className="input"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
        />
      </label>
      <label className="field">
        <span className="label">
          {t("typeToConfirm", { word: confirmWord })}
        </span>
        <input
          className="input"
          name="confirmation"
          required
          autoComplete="off"
        />
      </label>
      <div>
        <button className="btn btn-danger">{t("submit")}</button>
      </div>
      {message && (
        <p className="notice notice-danger" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
