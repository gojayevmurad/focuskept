"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Link, useRouter } from "@/src/i18n/navigation";
import { authClient } from "@/src/lib/auth/client";
import {
  credentialsSchema,
  passwordSchema,
  safeRedirect,
} from "@/src/lib/security/validation";
import { track, resetAnalytics } from "@/src/lib/analytics/client";

type Mode = "sign-in" | "sign-up" | "forgot-password" | "reset-password";

export function AuthForm({
  mode,
  google = false,
}: {
  mode: Mode;
  google?: boolean;
}) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const [busy, setBusy] = useState(false);
  // `next` is always a locale-less app path, e.g. /app/learn/new?topic=…
  const next = safeRedirect(params.get("next"), "/app");
  const localized = `/${locale}${next}`;

  function errorText(error: { code?: string; status?: number }) {
    if (error.status === 429) return t("tooManyAttempts");
    switch (error.code) {
      case "INVALID_EMAIL_OR_PASSWORD":
        return t("wrongCredentials");
      case "EMAIL_NOT_VERIFIED":
        return t("emailNotVerified");
      case "USER_ALREADY_EXISTS":
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
        return t("userExists");
      case "INVALID_TOKEN":
        return t("invalidToken");
      case "PASSWORD_TOO_SHORT":
      case "PASSWORD_TOO_LONG":
        return t("invalidPassword");
      default:
        return common("status.error");
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(undefined);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (
      (mode === "sign-in" || mode === "sign-up") &&
      !credentialsSchema.safeParse({ email, password }).success
    )
      return setMessage({ text: t("invalidCredentials"), error: true });
    if (
      mode === "reset-password" &&
      !passwordSchema.safeParse(password).success
    )
      return setMessage({ text: t("invalidPassword"), error: true });
    setBusy(true);
    try {
      if (mode === "forgot-password") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `/${locale}/reset-password`,
        });
        if (result.error) throw result.error;
        setMessage({ text: t("resetSent"), error: false });
      } else if (mode === "reset-password") {
        const result = await authClient.resetPassword({
          newPassword: password,
          token: params.get("token") || "",
        });
        if (result.error) throw result.error;
        setMessage({ text: t("resetDone"), error: false });
      } else if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          email,
          password,
          name: String(data.get("name") || "").trim(),
          // The verification link signs the user in and lands here.
          callbackURL: localized,
        });
        if (result.error) throw result.error;
        track("user_signed_up");
        router.push("/verify-email");
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: localized,
        });
        if (result.error) throw result.error;
        track("user_logged_in");
        router.push(next);
        router.refresh();
      }
    } catch (error) {
      setMessage({
        text: errorText(error as { code?: string; status?: number }),
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = {
    "sign-in": t("submitSignIn"),
    "sign-up": t("submitSignUp"),
    "forgot-password": t("submitForgot"),
    "reset-password": t("submitReset"),
  }[mode];

  return (
    <div className="stack">
      {google && (mode === "sign-in" || mode === "sign-up") && (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() =>
              authClient.signIn.social({
                provider: "google",
                callbackURL: localized,
              })
            }
          >
            <GoogleIcon />
            {t("google")}
          </button>
          <div
            className="flex items-center gap-3 tiny muted"
            aria-hidden="true"
          >
            <hr className="flex-1 border-border" />
            {t("or")}
            <hr className="flex-1 border-border" />
          </div>
        </>
      )}
      <form onSubmit={submit} className="stack" noValidate>
        {mode === "sign-up" && (
          <label className="field">
            <span className="label">{t("name")}</span>
            <input
              className="input"
              name="name"
              autoComplete="name"
              required
              maxLength={80}
              placeholder={t("namePlaceholder")}
            />
          </label>
        )}
        {mode !== "reset-password" && (
          <label className="field">
            <span className="label">{t("email")}</span>
            <input
              className="input"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={t("emailPlaceholder")}
              dir="ltr"
            />
          </label>
        )}
        {mode !== "forgot-password" && (
          <div className="field">
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="password">
                {mode === "reset-password" ? t("newPassword") : t("password")}
              </label>
              {mode === "sign-in" && (
                <Link href="/forgot-password" className="link tiny">
                  {t("forgotLink")}
                </Link>
              )}
            </div>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              required
              minLength={12}
              maxLength={128}
              placeholder={t("passwordPlaceholder")}
              dir="ltr"
            />
          </div>
        )}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy && <LoaderCircle size={17} className="animate-spin" />}
          {submitLabel}
          <ArrowRight size={16} className="rtl-flip" />
        </button>
        {message && (
          <p
            role={message.error ? "alert" : "status"}
            className={
              message.error ? "notice notice-danger" : "notice notice-success"
            }
          >
            {message.text}
          </p>
        )}
      </form>
      {(mode === "sign-in" || mode === "sign-up") && (
        <p className="small muted text-center">
          {mode === "sign-up" ? t("haveAccount") : t("noAccount")}{" "}
          <Link
            className="link"
            href={{
              pathname: mode === "sign-up" ? "/sign-in" : "/sign-up",
              query: params.get("next") ? { next } : undefined,
            }}
          >
            {mode === "sign-up" ? t("signInLink") : t("createAccount")}
          </Link>
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
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

export function SignOutButton({
  className = "nav-link w-full",
}: {
  className?: string;
}) {
  const t = useTranslations("common.nav");
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await authClient.signOut();
        resetAnalytics();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      {t("signOut")}
    </button>
  );
}
