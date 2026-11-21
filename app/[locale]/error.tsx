"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("errors");
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main className="empty-state">
      <h1>{t("generic")}</h1>
      <p>{t("tryAgainLater")}</p>
      <button className="button" onClick={reset}>
        {t("retry")}
      </button>
    </main>
  );
}
