// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import {
  pageMetadata,
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import styles from "./community-guidelines.module.css";

export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: "communityGuidelinesPage",
  });
  const app = getAppConfig();
  return pageMetadata(
    t("title", { app: app.name }),
    t("lead"),
    "/community-guidelines",
    locale,
  );
}

export default async function CommunityGuidelinesPage({
  params,
}: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("communityGuidelinesPage");
  const app = getAppConfig();

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
            <h2>{t("principlesTitle")}</h2>
            <ul className={styles.guidelineList}>
              <li>{t("principleRespect")}</li>
              <li>{t("principlePresence")}</li>
              <li>{t("principleQuiet")}</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>{t("onCameraTitle")}</h2>
            <ul className={styles.guidelineList}>
              <li>{t("cameraClothing")}</li>
              <li>{t("cameraWorkspace")}</li>
              <li>{t("cameraEnvironment")}</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>{t("prohibitedTitle")}</h2>
            <ul className={`${styles.guidelineList} ${styles.dangerList}`}>
              <li>{t("prohibitedNudity")}</li>
              <li>{t("prohibitedHarassment")}</li>
              <li>{t("prohibitedRecording")}</li>
              <li>{t("prohibitedCommercial")}</li>
              <li>{t("prohibitedDating")}</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>{t("safetyTitle")}</h2>
            <p>{t("safetyText")}</p>
            <ul className={styles.guidelineList}>
              <li>{t("safetyLeave")}</li>
              <li>{t("safetyReport")}</li>
              <li>{t("safetyNoRecording")}</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>{t("consequencesTitle")}</h2>
            <ul className={styles.guidelineList}>
              <li>{t("consequencesReview")}</li>
              <li>{t("consequencesThreeReports")}</li>
              <li>{t("consequencesZeroTolerance")}</li>
            </ul>
            <div className={styles.actionCallout}>
              <p>{t("questionsPrompt", { email: app.supportEmail })}</p>
            </div>
          </section>
        </div>

        <div className={styles.legalLinks}>
          <Link href="/terms">Terms of service</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/contact">Contact support</Link>
        </div>
      </article>
    </div>
  );
}
