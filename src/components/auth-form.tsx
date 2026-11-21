// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Link, useRouter } from "@/src/i18n/navigation";
import { authClient } from "@/src/lib/auth/client";
import {
  credentialsSchema,
  passwordSchema,
  safeRedirect,
} from "@/src/lib/security/validation";
import { track } from "@/src/lib/analytics/client";

type Mode = "sign-in" | "sign-up" | "forgot-password" | "reset-password";

export function AuthForm({
  mode,
  google = false,
  appName = "",
}: {
  mode: Mode;
  google?: boolean;
  appName?: string;
}) {
  const t = useTranslations("auth");
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirect(params.get("next") ?? undefined);
  const signup = mode === "sign-up";
  const forgot = mode === "forgot-password";
  const reset = mode === "reset-password";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "");
    const password = String(data.get("password") || "");
    if (
      !forgot &&
      !reset &&
      !credentialsSchema.safeParse({ email, password }).success
    )
      return setMessage({ text: t("invalid") });
    if (reset && !passwordSchema.safeParse(password).success)
      return setMessage({ text: t("passwordInvalid") });
    if (signup && data.get("age") !== "on")
      return setMessage({ text: t("ageRequired", { app: appName }) });
    setBusy(true);
    try {
      const result = forgot
        ? await authClient.requestPasswordReset({
            email,
            redirectTo: "/reset-password",
          })
        : reset
          ? await authClient.resetPassword({
              newPassword: password,
              token: params.get("token") || "",
            })
          : signup
            ? await authClient.signUp.email({
                email,
                password,
                name: String(data.get("name")).trim(),
                callbackURL: next,
              })
            : await authClient.signIn.email({
                email,
                password,
                callbackURL: next,
              });
      if (result.error) throw new Error(result.error.message || "");
      if (forgot) setMessage({ text: t("resetSent"), ok: true });
      else if (reset) setMessage({ text: t("passwordUpdated"), ok: true });
      else if (signup) {
        track("signup");
        router.push("/verify-email");
      } else {
        track("user_logged_in");
        location.assign(next);
      }
    } catch (error) {
      setMessage({
        text:
          error instanceof Error && error.message
            ? error.message
            : t("invalid"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {google && (signup || mode === "sign-in") && (
        <>
          <button
            type="button"
            className="button secondary full"
            onClick={() =>
              authClient.signIn.social({
                provider: "google",
                callbackURL: next,
              })
            }
          >
            <GoogleIcon /> {t("google")}
          </button>
          <div className="or">{t("or")}</div>
        </>
      )}
      <form onSubmit={submit} className="form" noValidate>
        {signup && (
          <label className="field">
            {t("name")}
            <input
              name="name"
              autoComplete="name"
              required
              maxLength={60}
              placeholder={t("namePlaceholder")}
            />
          </label>
        )}
        {!reset && (
          <label className="field">
            {t("email")}
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>
        )}
        {!forgot && (
          <div className="field">
            <span>
              <label htmlFor="auth-password">{t("password")}</label>
              {mode === "sign-in" && (
                <Link href="/forgot-password" className="link small">
                  {t("forgot")}
                </Link>
              )}
            </span>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={
                signup || reset ? "new-password" : "current-password"
              }
              required
              minLength={12}
              maxLength={128}
              placeholder={t("passwordPlaceholder")}
            />
          </div>
        )}
        {signup && (
          <label className="check">
            <input type="checkbox" name="age" required />
            <span>
              {t.rich("ageConfirm", {
                terms: (c) => (
                  <Link href="/terms" className="link">
                    {c}
                  </Link>
                ),
                privacy: (c) => (
                  <Link href="/privacy" className="link">
                    {c}
                  </Link>
                ),
              })}
            </span>
          </label>
        )}
        <button className="button full" disabled={busy}>
          {busy && <LoaderCircle size={17} className="spin" />}
          {signup
            ? t("submitSignUp")
            : forgot
              ? t("sendReset")
              : reset
                ? t("updatePassword")
                : t("submitSignIn")}
          {!busy && <ArrowRight size={16} />}
        </button>
        {message && (
          <p role="status" className={`notice ${message.ok ? "ok" : "error"}`}>
            {message.text}
          </p>
        )}
      </form>
      {(signup || mode === "sign-in") && (
        <p className="auth-alt">
          {signup
            ? t.rich("haveAccount", {
                link: (c) => (
                  <Link
                    href={`/sign-in${params.size ? `?${params}` : ""}`}
                    className="link"
                  >
                    {c}
                  </Link>
                ),
              })
            : t.rich("noAccount", {
                link: (c) => (
                  <Link
                    href={`/sign-up${params.size ? `?${params}` : ""}`}
                    className="link"
                  >
                    {c}
                  </Link>
                ),
              })}
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
