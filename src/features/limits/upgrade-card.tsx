"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { track } from "@/src/lib/analytics/client";

export type UpgradeReason =
  | "card_limit"
  | "monthly_limit"
  | "reanalysis_limit"
  | "budget"
  | "lab"
  | "weekly_report";

/** Calm, non-blocking upgrade note shown where a Free limit applies. */
export function UpgradeCard({
  reason,
  values = {},
  children,
}: {
  reason: UpgradeReason;
  values?: Record<string, number>;
  children?: React.ReactNode;
}) {
  const t = useTranslations("limits");
  useEffect(() => {
    if (reason === "budget") return;
    const source =
      reason === "monthly_limit" || reason === "reanalysis_limit"
        ? "ai_limit"
        : reason;
    track("upgrade_viewed", { source });
    if (source === "ai_limit")
      track("ai_limit_reached", { feature: "ai_analysis" });
  }, [reason]);
  return (
    <aside className="card card-accent stack" style={{ gap: 10 }} role="note">
      <h2 className="card-title flex items-center gap-2">
        <Sparkles size={17} className="text-accent" aria-hidden="true" />
        {t(`${reason}.title`)}
      </h2>
      <p className="small">{t(`${reason}.text`, values)}</p>
      {reason !== "budget" && (
        <>
          <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
            <li>{t("pro.cards")}</li>
            <li>{t("pro.ai")}</li>
            <li>{t("pro.lab")}</li>
            <li>{t("pro.weekly")}</li>
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/pricing" className="btn btn-primary btn-sm">
              {t("cta")}
            </Link>
            <span className="hint">{t("keepWorking")}</span>
          </div>
        </>
      )}
      {children}
    </aside>
  );
}
