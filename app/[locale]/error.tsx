// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { LaneRope } from "@/src/components/lanes";
import styles from "./not-found.module.css";

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
    <main className={`empty-state ${styles.emptyState}`}>
      <div className={styles.laneCard}>
        <LaneRope className={styles.rope} />
        <h1>{t("generic")}</h1>
        <p className="muted">{t("tryAgainLater")}</p>
        <button className="button" onClick={reset}>
          {t("retry")}
        </button>
      </div>
    </main>
  );
}
