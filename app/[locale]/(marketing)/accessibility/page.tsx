// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import {
  pageMetadata,
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import styles from "./accessibility.module.css";

export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "accessibilityPage" });
  const app = getAppConfig();
  return pageMetadata(
    t("title", { app: app.name }),
    t("lead", { app: app.name }),
    "/accessibility",
    locale,
  );
}

export default async function AccessibilityPage({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("accessibilityPage");
  const site = await getTranslations("site");
  const app = getAppConfig();

  return (
    <div className={`container ${styles.page}`}>
      <article className={styles.article}>
        <header className={styles.pageHead}>
          <h1>{t("heading")}</h1>
          <p className={styles.lead}>{t("lead", { app: app.name })}</p>
          <p className={styles.updated}>{t("updated")}</p>
        </header>

        <div className={styles.reading}>
          <section className={styles.section}>
            <h2>{t("standardTitle")}</h2>
            <p>{t("standardText")}</p>
          </section>

          <section className={styles.section}>
            <h2>{t("featuresTitle")}</h2>
            <ul className={styles.featureList}>
              <li>{t("featSemantic")}</li>
              <li>{t("featContrast")}</li>
              <li>{t("featMotion")}</li>
              <li>{t("featKeyboard")}</li>
              <li>{t("featTouch")}</li>
              <li>{t("featTabular")}</li>
              <li>{t("featQuiet")}</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>{t("limitationsTitle")}</h2>
            <ul className={styles.featureList}>
              <li>{t("limVideo")}</li>
              <li>{t("limWebRTC")}</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>{t("feedbackTitle")}</h2>
            <p>
              {t.rich("feedbackText", {
                contactLink: (chunks) => <Link href="/contact">{chunks}</Link>,
                email: app.supportEmail,
              })}
            </p>
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
