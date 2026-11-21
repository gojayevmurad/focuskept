// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";
import { track } from "@/src/lib/analytics/client";
import type { AnalyticsEvent } from "@/src/lib/analytics/events";

export function CopyLink({
  value,
  event,
}: {
  value: string;
  event?: AnalyticsEvent;
}) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  return (
    <div className="row">
      <input
        className="input grow mono small"
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={t("copy")}
      />
      <button
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {}
          if (event) track(event);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}
