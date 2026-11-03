"use client";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { LanguageSelect } from "./language-select";
import { ThemeSelect } from "./theme-select";

/** The visitor menu: everything that is not the timer lives here. */
export function SiteMenu() {
  const t = useTranslations("common.nav");
  const theme = useTranslations("common.theme");
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        popoverTarget="site-menu"
        aria-label={t("menu")}
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <div id="site-menu" popover="auto" className="menu menu-panel">
        <nav aria-label={t("mainNavigation")} className="flex flex-col">
          <Link href="/" className="menu-item">
            {t("timer")}
          </Link>
          <Link href="/#how" className="menu-item">
            {t("howItWorks")}
          </Link>
          <Link href="/techniques" className="menu-item">
            {t("guide")}
          </Link>
          <Link href="/pricing" className="menu-item">
            {t("pricing")}
          </Link>
          <Link href="/about" className="menu-item">
            {t("about")}
          </Link>
        </nav>
        <div className="menu-section">
          <LanguageSelect showLabel />
          <div className="field">
            <span className="label">{theme("label")}</span>
            <ThemeSelect />
          </div>
        </div>
      </div>
    </>
  );
}
