import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { brand } from "@/src/config/brand";
import { Logo } from "./logo";
import { LanguageSelect } from "./language-select";

export async function SiteFooter() {
  const t = await getTranslations("common.footer");
  const nav = await getTranslations("common.nav");
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="flex flex-col gap-3">
          <Link href="/" className="logo">
            <Logo />
          </Link>
          <p>{t("tagline")}</p>
          <LanguageSelect />
        </div>
        <div>
          <h2>{t("product")}</h2>
          <ul>
            <li>
              <Link href="/focus">{t("focusTimer")}</Link>
            </li>
            <li>
              <Link href="/learn">{t("learningMode")}</Link>
            </li>
            <li>
              <Link href="/techniques">{nav("techniques")}</Link>
            </li>
            <li>
              <Link href="/pricing">{nav("pricing")}</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2>{t("company")}</h2>
          <ul>
            <li>
              <Link href="/about">{nav("about")}</Link>
            </li>
            <li>
              <a href={`mailto:${brand.supportEmail}`}>{t("contact")}</a>
            </li>
          </ul>
        </div>
        <div>
          <h2>{t("legal")}</h2>
          <ul>
            <li>
              <Link href="/privacy">{t("privacy")}</Link>
            </li>
            <li>
              <Link href="/terms">{t("terms")}</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container mt-8 tiny">
        {t("copyright", { year: new Date().getFullYear(), brand: brand.name })}
      </div>
    </footer>
  );
}
