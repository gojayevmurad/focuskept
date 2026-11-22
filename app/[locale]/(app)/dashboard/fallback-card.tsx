// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { chooseFallback } from "../book/actions";
import styles from "./dashboard.module.css";

export function FallbackCard({
  bookingId,
  when,
}: {
  bookingId: string;
  when: string;
}) {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const choose = (choice: "room" | "next" | "cancel") =>
    start(async () => {
      const result = await chooseFallback(bookingId, choice);
      if (!result.ok) return setError(true);
      if (choice === "room" && result.id) router.push(`/session/${result.id}`);
      else router.refresh();
    });
  return (
    <section className={styles.fallback}>
      <div className={styles.fallbackCopy}>
        <h2>{t("fallbackTitle")}</h2>
        <span className={styles.partner}>{t("fallbackBadge")}</span>
        <p className={styles.meta}>{t("fallbackLead", { when })}</p>
      </div>
      {error && (
        <p className={styles.error} role="status">
          {c("somethingWrong")}
        </p>
      )}
      <div className={styles.actions}>
        <button
          className={styles.button}
          disabled={pending}
          onClick={() => choose("room")}
        >
          {t("fallbackRoom")}
        </button>
        <button
          className={styles.buttonSecondary}
          disabled={pending}
          onClick={() => choose("next")}
        >
          {t("fallbackNext")}
        </button>
        <button
          className={styles.buttonGhost}
          disabled={pending}
          onClick={() => choose("cancel")}
        >
          {t("fallbackCancel")}
        </button>
      </div>
    </section>
  );
}
