"use client";
import { useState } from "react";
import { disableAnalytics, enableAnalytics } from "@/src/lib/analytics/client";
export function AnalyticsPreferences() {
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
      setMessage(
        consent
          ? "Optional analytics enabled."
          : "Optional analytics disabled.",
      );
    } catch {
      setMessage("Unable to update preferences.");
    }
  }
  return (
    <>
      <div className="inline-actions">
        <button className="button secondary" onClick={() => set(true)}>
          Allow analytics
        </button>
        <button className="button secondary" onClick={() => set(false)}>
          Disable analytics
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </>
  );
}
