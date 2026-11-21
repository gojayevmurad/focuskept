"use client";
import { useEffect, useState } from "react";
import {
  enableAnalytics,
  disableAnalytics,
  identify,
} from "@/src/lib/analytics/client";
export function ConsentBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const consent = localStorage.getItem("analytics-consent");
    if (consent === "yes") enableAnalytics();
    else if (!consent) {
      const timer = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);
  if (!show) return null;
  return (
    <aside className="consent" aria-label="Analytics preferences">
      <p>
        Help us understand how the product is used? Optional analytics stay off
        until you choose.
      </p>
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
          Allow analytics
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
          No thanks
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
