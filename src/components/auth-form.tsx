"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { authClient } from "@/src/lib/auth/client";
import {
  credentialsSchema,
  passwordSchema,
} from "@/src/lib/security/validation";
import { track, resetAnalytics } from "@/src/lib/analytics/client";
export function AuthForm({
  mode,
  google = false,
}: {
  mode: "sign-in" | "sign-up" | "forgot-password" | "reset-password";
  google?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const signup = mode === "sign-up";
  const forgot = mode === "forgot-password";
  const reset = mode === "reset-password";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "");
    const password = String(data.get("password") || "");
    try {
      if (
        !forgot &&
        !reset &&
        !credentialsSchema.safeParse({ email, password }).success
      )
        throw new Error(
          "Enter a valid email and a password of 12–128 characters.",
        );
      if (reset && !passwordSchema.safeParse(password).success)
        throw new Error("Use a password of 12–128 characters.");
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
                name: String(data.get("name")),
                callbackURL: "/verify-email",
              })
            : await authClient.signIn.email({
                email,
                password,
                callbackURL: "/dashboard",
              });
      if (result.error)
        throw new Error(result.error.message || "Please try again.");
      if (forgot)
        setMessage(
          "If an account exists, a password reset email is on its way.",
        );
      else if (reset) {
        setMessage("Password updated. You can sign in now.");
      } else if (signup) {
        track("user_signed_up");
        router.push("/verify-email");
      } else {
        track("user_logged_in");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form onSubmit={submit} className="form">
        {signup && (
          <label>
            Your name
            <input
              name="name"
              autoComplete="name"
              required
              maxLength={80}
              placeholder="Alex Morgan"
            />
          </label>
        )}
        {!reset && (
          <label>
            Email address
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
          <label>
            <span>
              Password
              {mode === "sign-in" && (
                <Link href="/forgot-password">Forgot password?</Link>
              )}
            </span>
            <input
              aria-label="Password"
              name="password"
              type="password"
              autoComplete={
                signup || reset ? "new-password" : "current-password"
              }
              required
              minLength={12}
              maxLength={128}
              placeholder="At least 12 characters"
            />
          </label>
        )}
        <button className="button" disabled={busy}>
          {busy ? <LoaderCircle size={17} className="spin" /> : null}
          {signup
            ? "Create your account"
            : forgot
              ? "Send reset link"
              : reset
                ? "Update password"
                : "Sign in to your workspace"}
          <ArrowRight size={16} />
        </button>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </form>
      {google && (
        <button
          className="button secondary full"
          onClick={() =>
            authClient.signIn.social({
              provider: "google",
              callbackURL: "/dashboard",
            })
          }
        >
          Continue with Google
        </button>
      )}
      <p className="form-footer">
        {signup ? (
          <>
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/sign-up">Create an account</Link>
          </>
        )}
      </p>
    </>
  );
}
export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="button secondary small"
      onClick={async () => {
        await authClient.signOut();
        resetAnalytics();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
