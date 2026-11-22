// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { appConfig } from "@/src/lib/db/schema";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import {
  pageMetadata,
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import styles from "./status.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "statusPage" });
  const app = getAppConfig();
  return pageMetadata(
    t("title", { app: app.name }),
    t("lead"),
    "/status",
    locale,
  );
}

export default async function StatusPage({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("statusPage");
  const format = await getFormatter();

  let dbStatus: "connected" | "unconfigured" | "error" = "unconfigured";
  let workerStatus: "ok" | "stale" | "unknown" = "unknown";

  if (process.env.DATABASE_URL) {
    try {
      await db().execute(sql`select 1`);
      dbStatus = "connected";

      const [heartbeat] = await db()
        .select({ value: appConfig.value })
        .from(appConfig)
        .where(eq(appConfig.key, "worker_heartbeat"))
        .limit(1);

      const timestamp =
        typeof heartbeat?.value === "string" ? Date.parse(heartbeat.value) : NaN;
      if (Number.isFinite(timestamp)) {
        workerStatus = Date.now() - timestamp > 3 * 60_000 ? "stale" : "ok";
      }
    } catch {
      dbStatus = "error";
    }
  }

  const appOperational = true;
  const dbOperational = dbStatus === "connected" || dbStatus === "unconfigured";
  const workerOperational = workerStatus === "ok" || workerStatus === "unknown";
  const allOperational = appOperational && dbOperational && workerOperational;

  const checkTime = format.dateTime(new Date(), {
    timeStyle: "medium",
    dateStyle: "medium",
    timeZone: "UTC",
  });

  return (
    <div className={`container ${styles.page}`}>
      <article className={styles.article}>
        <header className={styles.pageHead}>
          <h1>{t("heading")}</h1>
          <p className={styles.lead}>{t("lead")}</p>
        </header>

        <div
          className={`${styles.overallBanner} ${allOperational ? styles.overallOk : styles.overallDegraded}`}
        >
          <div className={styles.overallStatus}>
            <span
              className={`${styles.statusDot} ${allOperational ? styles.statusDotOk : styles.statusDotDegraded}`}
              aria-hidden="true"
            />
            <span>{allOperational ? t("operational") : t("degraded")}</span>
          </div>
          <span className={styles.checkTime}>
            {t("lastChecked", { time: `${checkTime} UTC` })}
          </span>
        </div>

        <div className={styles.grid}>
          {/* Web App */}
          <div className={styles.componentCard}>
            <div className={styles.componentInfo}>
              <span className={styles.componentTitle}>{t("webApp")}</span>
              <span className={styles.componentDesc}>{t("webAppDesc")}</span>
            </div>
            <span className={styles.badgeOk}>{t("statusOk")}</span>
          </div>

          {/* Database */}
          <div className={styles.componentCard}>
            <div className={styles.componentInfo}>
              <span className={styles.componentTitle}>{t("database")}</span>
              <span className={styles.componentDesc}>{t("databaseDesc")}</span>
            </div>
            {dbStatus === "connected" ? (
              <span className={styles.badgeOk}>{t("statusConnected")}</span>
            ) : dbStatus === "unconfigured" ? (
              <span className={styles.badgeWarn}>{t("statusUnknown")}</span>
            ) : (
              <span className={styles.badgeError}>{t("statusDisconnected")}</span>
            )}
          </div>

          {/* Worker */}
          <div className={styles.componentCard}>
            <div className={styles.componentInfo}>
              <span className={styles.componentTitle}>{t("worker")}</span>
              <span className={styles.componentDesc}>{t("workerDesc")}</span>
            </div>
            {workerStatus === "ok" ? (
              <span className={styles.badgeOk}>{t("statusOk")}</span>
            ) : workerStatus === "stale" ? (
              <span className={styles.badgeWarn}>{t("statusStale")}</span>
            ) : (
              <span className={styles.badgeWarn}>{t("statusUnknown")}</span>
            )}
          </div>
        </div>

        <section className={styles.section}>
          <h2>{t("incidentHistory")}</h2>
          <p>{t("noIncidents")}</p>
        </section>

        <div className={styles.legalLinks}>
          <Link href="/help">Help center</Link>
          <Link href="/contact">Contact support</Link>
          <Link href="/terms">Terms of service</Link>
          <Link href="/privacy">Privacy policy</Link>
        </div>
      </article>
    </div>
  );
}
