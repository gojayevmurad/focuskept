"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { SignOutButton } from "./auth-form";
import { LanguageSelect } from "./language-select";
import { ThemeSelect } from "./theme-select";

/** Avatar → settings, billing, language, theme and sign-out. */
export function AccountMenu({ name }: { name: string }) {
  const t = useTranslations("common.nav");
  const theme = useTranslations("common.theme");
  const initial = (name.trim()[0] ?? "•").toLocaleUpperCase();
  return (
    <>
      <button
        type="button"
        className="avatar"
        popoverTarget="account-menu"
        aria-label={t("account")}
      >
        <span aria-hidden="true">{initial}</span>
      </button>
      <div id="account-menu" popover="auto" className="menu menu-panel">
        <p className="menu-name" dir="auto">
          {name}
        </p>
        <Link href="/app/settings" className="menu-item">
          {t("settings")}
        </Link>
        <Link href="/app/billing" className="menu-item">
          {t("billing")}
        </Link>
        <div className="menu-section">
          <LanguageSelect showLabel />
          <div className="field">
            <span className="label">{theme("label")}</span>
            <ThemeSelect />
          </div>
        </div>
        <SignOutButton className="menu-item" />
      </div>
    </>
  );
}
