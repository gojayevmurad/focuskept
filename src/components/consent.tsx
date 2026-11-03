"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  enableAnalytics,
  disableAnalytics,
  identify,
} from "@/src/lib/analytics/client";

function readConsent() {
  try {
    return localStorage.getItem("analytics-consent");
  } catch {
    return "no";
  }
}

export function ConsentBanner() {
  const t = useTranslations("common.consent");
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const consent = readConsent();
    if (consent === "yes") enableAnalytics();
    else if (!consent) {
      const timer = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);
  if (!show) return null;
  const choose = (value: "yes" | "no") => {
    try {
      localStorage.setItem("analytics-consent", value);
    } catch {}
    if (value === "yes") enableAnalytics();
    else disableAnalytics();
    setShow(false);
    window.dispatchEvent(new Event("analytics-consent"));
  };
  return (
    <aside className="consent" aria-label={t("label")}>
      <p className="mb-3">{t("text")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => choose("yes")}
        >
          {t("allow")}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => choose("no")}
        >
          {t("decline")}
        </button>
      </div>
    </aside>
  );
}

export function AnalyticsIdentity({ id }: { id: string }) {
  useEffect(() => {
    const apply = () => {
      const consent = readConsent();
      if (consent)
        void fetch("/api/account/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent: consent === "yes" }),
        }).catch(() => {});
      if (consent === "yes") {
        enableAnalytics();
        identify(id);
      }
    };
    apply();
    window.addEventListener("analytics-consent", apply);
    return () => window.removeEventListener("analytics-consent", apply);
  }, [id]);
  return null;
}
