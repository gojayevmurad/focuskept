// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { Logo } from "./logo";

export async function SiteFooter() {
  const t = await getTranslations("site");
  const app = getAppConfig();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="stack-sm">
          <Logo name={app.name} logoUrl={app.logoUrl} />
          <p className="small">{t("tagline")}</p>
          <p className="small faint">{t("openSource")}</p>
        </div>
        {app.marketingEnabled ? (
          <>
            <div>
              <h4>{t("product")}</h4>
              <ul>
                <li>
                  <Link href="/how-it-works">{t("how")}</Link>
                </li>
                {app.billingEnabled && (
                  <li>
                    <Link href="/pricing">{t("pricing")}</Link>
                  </li>
                )}
                <li>
                  <Link href="/faq">{t("faq")}</Link>
                </li>
                <li>
                  <Link href="/blog">{t("blog")}</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4>{t("useCases")}</h4>
              <ul>
                <li>
                  <Link href="/body-doubling-for/adhd">{t("adhd")}</Link>
                </li>
                <li>
                  <Link href="/study-with-me/bar-exam">{t("barExam")}</Link>
                </li>
                <li>
                  <Link href="/body-doubling-for/writers">{t("writers")}</Link>
                </li>
                <li>
                  <Link href="/virtual-coworking-for/software-engineers">
                    {t("developers")}
                  </Link>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <div />
        )}
        <div>
          <h4>{t("company")}</h4>
          <ul>
            <li>
              <Link href="/privacy">{t("privacy")}</Link>
            </li>
            <li>
              <Link href="/terms">{t("terms")}</Link>
            </li>
            <li>
              <a href={`mailto:${app.supportEmail}`}>{t("contact")}</a>
            </li>
            <li>
              <a href="https://github.com/gojayevmurad/focuskept">
                {t("source")}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
