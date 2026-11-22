// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { disableAnalytics, enableAnalytics } from "@/src/lib/analytics/client";

export function AnalyticsPreferences() {
  const t = useTranslations("analytics.preferences");
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
      setMessage(consent ? t("enabledMessage") : t("disabledMessage"));
    } catch {
      setMessage(t("errorMessage"));
    }
  }

  return (
    <>
      <div className="inline-actions">
        <button className="button secondary" onClick={() => set(true)}>
          {t("allow")}
        </button>
        <button className="button secondary" onClick={() => set(false)}>
          {t("disable")}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </>
  );
}
