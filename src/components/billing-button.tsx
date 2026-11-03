"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { track } from "@/src/lib/analytics/client";

export function BillingButton({
  plan,
  portal = false,
  label,
  variant = "primary",
}: {
  plan?: "monthly" | "yearly";
  portal?: boolean;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button
        className={`btn btn-${variant} btn-block`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch(
              `/api/billing/${portal ? "portal" : "checkout"}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, locale }),
              },
            );
            if (response.status === 401) {
              router.push({
                pathname: "/sign-in",
                query: { next: "/pricing" },
              });
              return;
            }
            const data = await response.json().catch(() => ({}));
            if (response.status === 503) throw new Error(t("notConfigured"));
            if (!response.ok || !data.url) throw new Error(t("unavailable"));
            if (!portal) track("checkout_started", { plan });
            location.assign(data.url);
          } catch (e) {
            setMessage(e instanceof Error ? e.message : t("unavailable"));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t("connecting") : label}
      </button>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
