// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  enableAnalytics,
  disableAnalytics,
  identify,
  useAnalyticsConfig,
} from "@/src/lib/analytics";

export function ConsentBanner() {
  const [show, setShow] = useState(false);
  const t = useTranslations("analytics.consentBanner");
  const config = useAnalyticsConfig();

  useEffect(() => {
    if (!config.enabled && !config.key) return;
    const consent = localStorage.getItem("analytics-consent");
    if (consent === "yes") {
      enableAnalytics();
    } else if (!consent) {
      const timer = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(timer);
    }
  }, [config]);

  if (!show) return null;

  return (
    <aside className="consent" aria-label="Analytics preferences">
      <p>{t("text")}</p>
      <div>
        <button
          className="button small"
          onClick={() => {
            localStorage.setItem("analytics-consent", "yes");
            enableAnalytics();
            setShow(false);
            window.dispatchEvent(new Event("analytics-consent"));
          }}
        >
          {t("allow")}
        </button>
        <button
          className="button secondary small"
          onClick={() => {
            localStorage.setItem("analytics-consent", "no");
            disableAnalytics();
            setShow(false);
            window.dispatchEvent(new Event("analytics-consent"));
          }}
        >
          {t("reject")}
        </button>
      </div>
    </aside>
  );
}

export function AnalyticsIdentity({ id }: { id: string }) {
  useEffect(() => {
    const apply = () => {
      const consent = localStorage.getItem("analytics-consent");
      if (consent)
        void fetch("/api/account/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent: consent === "yes" }),
        });
      if (localStorage.getItem("analytics-consent") === "yes") {
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
