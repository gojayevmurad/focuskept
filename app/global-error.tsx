"use client";
import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { defaultLocale, localeFromPath } from "@/src/i18n/config";

type Copy = { errorTitle: string; errorText: string };

// Replaces the root layout when it fails, so it cannot rely on the i18n
// provider. It loads the error copy for the locale in the URL on demand.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const [copy, setCopy] = useState<Copy>();
  const locale =
    typeof window === "undefined"
      ? defaultLocale
      : (localeFromPath(window.location.pathname) ?? defaultLocale);
  useEffect(() => {
    Sentry.captureException(error);
    import(`@/messages/${locale}.json`)
      .catch(() => import("@/messages/en.json"))
      .then((m) => setCopy(m.default.errors as Copy))
      .catch(() => {});
  }, [error, locale]);
  return (
    <html lang={locale}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1>{copy?.errorTitle}</h1>
          <p>{copy?.errorText}</p>
          <button
            onClick={reset}
            aria-label={copy?.errorTitle}
            style={{ fontSize: 24, padding: "8px 16px" }}
          >
            ↻
          </button>
        </main>
      </body>
    </html>
  );
}
