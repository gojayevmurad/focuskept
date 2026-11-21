"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { chooseFallback } from "../book/actions";

export function FallbackCard({ bookingId, when }: { bookingId: string; when: string }) {
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
    <section className="card stack" style={{ borderColor: "var(--warm)" }}>
      <div className="stack-sm">
        <span className="badge warm">{t("fallbackBadge")}</span>
        <h2>{t("fallbackTitle")}</h2>
        <p className="muted">{t("fallbackLead", { when })}</p>
      </div>
      {error && <p className="notice error">{c("somethingWrong")}</p>}
      <div className="row">
        <button className="button" disabled={pending} onClick={() => choose("room")}>
          {t("fallbackRoom")}
        </button>
        <button className="button secondary" disabled={pending} onClick={() => choose("next")}>
          {t("fallbackNext")}
        </button>
        <button className="button ghost" disabled={pending} onClick={() => choose("cancel")}>
          {t("fallbackCancel")}
        </button>
      </div>
    </section>
  );
}
