"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { disableAnalytics, enableAnalytics } from "@/src/lib/analytics/client";

export function AnalyticsPreferences() {
  const t = useTranslations("settings.analytics");
  const [message, setMessage] = useState("");
  async function set(consent: boolean) {
    try {
      const result = await fetch("/api/account/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent }),
      });
      if (!result.ok) throw new Error();
      localStorage.setItem("analytics-consent", consent ? "yes" : "no");
      if (consent) enableAnalytics();
      else disableAnalytics();
      window.dispatchEvent(new Event("analytics-consent"));
      setMessage(consent ? t("enabled") : t("disabled"));
    } catch {
      setMessage(t("error"));
    }
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-secondary" onClick={() => set(true)}>
          {t("allow")}
        </button>
        <button className="btn btn-secondary" onClick={() => set(false)}>
          {t("disable")}
        </button>
      </div>
      {message && (
        <p role="status" className="hint mt-2">
          {message}
        </p>
      )}
    </>
  );
}
