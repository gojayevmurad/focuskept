"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { readLocal } from "./local-store";

/**
 * First visit only: one line that explains the loop. After the first finished
 * session the line and the landing explainer step aside.
 */
export function HintLine() {
  const t = useTranslations("home");
  const returning = readLocal().sessions.length > 0;
  useEffect(() => {
    if (returning) document.documentElement.dataset.returning = "";
  }, [returning]);
  if (returning) return null;
  return (
    <p className="hint-line">
      <span className="hint-step">
        <span className="hint-dot is-teal" aria-hidden="true" />
        {t("hintFocus")}
      </span>
      <span aria-hidden="true" className="hint-arrow rtl-flip">
        →
      </span>
      <span className="hint-step">
        <span className="hint-dot is-square" aria-hidden="true" />
        {t("hintWrite")}
      </span>
      <span aria-hidden="true" className="hint-arrow rtl-flip">
        →
      </span>
      <span className="hint-step">
        <span className="hint-dot is-amber" aria-hidden="true" />
        {t("hintAsk")}
      </span>
      <Link href="/#how" className="hint-how">
        {t("howItWorks")}
      </Link>
    </p>
  );
}
