// SPDX-License-Identifier: AGPL-3.0-only
import { useTranslations } from "next-intl";
import styles from "./first-run.module.css";
export function FirstRunGuide({ appName }: { appName: string }) {
  const t = useTranslations("dashboard");
  return (
    <section className={styles.panel} data-tour="first-run">
      <header>
        <h2>{t("firstRunTitle", { app: appName })}</h2>
        <p className="muted">{t("explainerLead")}</p>
      </header>
      <div className={styles.timelineGrid}>
        {[1, 2, 3, 4].map((n) => (
          <div className={styles.timelineItem} key={n}>
            <span className={styles.timelineTime}>
              {t(`firstRunTimeline${n}Time`)}
            </span>
            <h3 className={styles.timelineTitle}>
              {t(`firstRunTimeline${n}Title`)}
            </h3>
            <p className={styles.timelineDesc}>
              {t(`firstRunTimeline${n}Desc`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
