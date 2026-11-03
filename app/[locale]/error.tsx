"use client";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const common = useTranslations("common.actions");
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main
      className="empty"
      style={{ minHeight: "60dvh", justifyContent: "center" }}
    >
      <h1>{t("errorTitle")}</h1>
      <p>{t("errorText")}</p>
      <button className="btn btn-primary" onClick={reset}>
        {common("retry")}
      </button>
    </main>
  );
}
