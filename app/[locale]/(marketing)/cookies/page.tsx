// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import {
  pageMetadata,
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import styles from "./cookies.module.css";

export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cookiesPage" });
  const app = getAppConfig();
  return pageMetadata(
    t("title", { app: app.name }),
    t("lead"),
    "/cookies",
    locale,
  );
}

export default async function CookiesPage({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("cookiesPage");
  const site = await getTranslations("site");
  const app = getAppConfig();

  const rows = [
    {
      name: t("rowSessionName"),
      provider: t("firstParty"),
      purpose: t("rowSessionPurpose"),
      duration: t("rowSessionDuration"),
      type: t("rowSessionType"),
    },
    {
      name: t("rowLocaleName"),
      provider: t("firstParty"),
      purpose: t("rowLocalePurpose"),
      duration: t("rowLocaleDuration"),
      type: t("rowLocaleType"),
    },
    {
      name: t("rowThemeName"),
      provider: t("firstParty"),
      purpose: t("rowThemePurpose"),
      duration: t("rowThemeDuration"),
      type: t("rowThemeType"),
    },
    {
      name: t("rowAttrCookieName"),
      provider: t("firstParty"),
      purpose: t("rowAttrCookiePurpose"),
      duration: t("rowAttrCookieDuration"),
      type: t("rowAttrCookieType"),
    },
    {
      name: t("rowConsentName"),
      provider: t("firstParty"),
      purpose: t("rowConsentPurpose"),
      duration: t("rowConsentDuration"),
      type: t("rowConsentType"),
    },
    {
      name: t("rowAnalyticsName"),
      provider: t("posthog"),
      purpose: t("rowAnalyticsPurpose"),
      duration: t("rowAnalyticsDuration"),
      type: t("rowAnalyticsType"),
    },
  ];

  return (
    <div className={`container ${styles.page}`}>
      <article className={styles.article}>
        <header className={styles.pageHead}>
          <h1>{t("heading")}</h1>
          <p className={styles.lead}>{t("lead")}</p>
          <p className={styles.updated}>{t("updated")}</p>
        </header>

        <div className={styles.reading}>
          <section className={styles.section}>
            <h2>{t("overview")}</h2>
            <p>{t("overviewText")}</p>
          </section>

          <section className={styles.section}>
            <h2>{t("tableTitle")}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t("colName")}</th>
                    <th scope="col">{t("colProvider")}</th>
                    <th scope="col">{t("colPurpose")}</th>
                    <th scope="col">{t("colDuration")}</th>
                    <th scope="col">{t("colType")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <span className={styles.codeToken}>{row.name}</span>
                      </td>
                      <td>{row.provider}</td>
                      <td>{row.purpose}</td>
                      <td>{row.duration}</td>
                      <td>{row.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.section}>
            <h2>{t("manageTitle")}</h2>
            <p>{t("manageText")}</p>
          </section>
        </div>

        <div className={styles.legalLinks}>
          <Link href="/privacy">{site("privacy")}</Link>
          <Link href="/terms">{site("terms")}</Link>
          <Link href="/contact">{site("contact")}</Link>
        </div>
      </article>
    </div>
  );
}
