// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getEnv } from "@/src/config/env";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import {
  pageMetadata,
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import styles from "./legal-notice.module.css";

export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legalNoticePage" });
  const app = getAppConfig();
  return pageMetadata(
    t("title", { app: app.name }),
    t("lead"),
    "/legal-notice",
    locale,
  );
}

export default async function LegalNoticePage({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("legalNoticePage");
  const site = await getTranslations("site");
  const env = getEnv();
  const app = getAppConfig();

  const entityName = env.LEGAL_ENTITY_NAME;
  const address = env.LEGAL_ADDRESS;
  const legalEmail = env.LEGAL_EMAIL || env.SUPPORT_EMAIL || app.supportEmail;
  const registration = env.LEGAL_REGISTRATION;

  const hasDetails = Boolean(entityName || address || registration);

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
            <h2>{t("operatorTitle")}</h2>
            {hasDetails ? (
              <div className={styles.detailsList}>
                {entityName ? (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>
                      {t("entityName")}
                    </span>
                    <span className={styles.detailValue}>{entityName}</span>
                  </div>
                ) : null}
                {address ? (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>{t("address")}</span>
                    <span className={styles.detailValue}>{address}</span>
                  </div>
                ) : null}
                {legalEmail ? (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>{t("contact")}</span>
                    <span className={styles.detailValue}>
                      <a href={`mailto:${legalEmail}`}>{legalEmail}</a>
                    </span>
                  </div>
                ) : null}
                {registration ? (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>
                      {t("registration")}
                    </span>
                    <span className={styles.detailValue}>{registration}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={styles.neutralCard}>
                <p>{t("notSetNotice", { email: legalEmail })}</p>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2>{t("hostingTitle")}</h2>
            <p>{t("hostingText")}</p>
          </section>

          <section className={styles.section}>
            <h2>{t("disclaimerTitle")}</h2>
            <p>{t("disclaimerText")}</p>
          </section>
        </div>

        <div className={styles.legalLinks}>
          <Link href="/privacy">{site("privacy")}</Link>
          <Link href="/terms">{site("terms")}</Link>
          <Link href="/cookies">Cookies & storage</Link>
          <Link href="/contact">{site("contact")}</Link>
        </div>
      </article>
    </div>
  );
}
