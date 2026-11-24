// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { requireAdmin } from "@/src/lib/app-user";
import {
  currentMetrics,
  needsAttention,
  overviewMetrics,
} from "@/src/lib/admin/metrics";
import { AdminFrame, sections } from "./frame";
import styles from "./admin.module.css";

export default async function Page() {
  const { profile } = await requireAdmin();
  const [t, format, metrics, attention, current] = await Promise.all([
    getTranslations("admin"),
    getFormatter(),
    overviewMetrics(profile.timezone),
    needsAttention(),
    currentMetrics(),
  ]);
  const kpis = [
    {
      key: "signups",
      value: format.number(metrics.signupsToday),
      detail: t("weekTotal", { count: metrics.signupsWeek }),
    },
    {
      key: "sessions",
      value: format.number(metrics.sessionsToday),
      detail: t("weekTotal", { count: metrics.sessionsWeek }),
    },
    {
      key: "matchRate",
      value: format.number(metrics.matchRate, {
        style: "percent",
        maximumFractionDigits: 1,
      }),
      detail: t("lastSevenDays"),
    },
    {
      key: "reports",
      value: format.number(metrics.reports),
      href: "/admin/reports",
    },
    {
      key: "supportTickets",
      value: format.number(metrics.support),
      href: "/admin/support?status=open",
    },
    {
      key: "waiting",
      value: format.number(metrics.waiting),
      href: "/admin/notifications",
    },
  ];
  return (
    <AdminFrame section="overview">
      <p className="small muted">
        {t("overviewTimezone", { timezone: profile.timezone })}
      </p>
      <section className={styles.kpis} aria-label={t("keyMetrics")}>
        {kpis.map((kpi) => (
          <div className={styles.kpi} key={kpi.key}>
            <span>{t(`metrics.${kpi.key}`)}</span>
            <strong>{kpi.value}</strong>
            {kpi.detail && <small>{kpi.detail}</small>}
            {kpi.href && <Link href={kpi.href}>{t("review")}</Link>}
          </div>
        ))}
      </section>
      <div className={styles.overview}>
        <section className="card stack">
          <h2>{t("needsAttention")}</h2>
          <p className="small muted">
            {t("unmatchedCount", { count: metrics.unmatched })}
          </p>
          {attention.length ? (
            <div className={styles.attention}>
              {attention.map((item) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={
                    item.kind === "support"
                      ? `/admin/support/${item.id}`
                      : item.kind === "booking"
                        ? "/admin/house"
                        : "/admin/reports"
                  }
                >
                  <span className="badge">
                    {t(`attentionKinds.${item.kind}`)}
                  </span>
                  <strong>
                    {item.kind === "report"
                      ? t.has(`reasons.${item.label}`)
                        ? t(`reasons.${item.label}`)
                        : t("reasons.other")
                      : item.label}
                  </strong>
                  <span className="small muted">
                    {format.dateTime(new Date(item.at), {
                      timeZone: profile.timezone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="notice ok">{t("allClear")}</p>
          )}
        </section>
        <section className="stack">
          <h2>{t("quickLinks")}</h2>
          <div className={styles.links}>
            {sections
              .filter((s) => s !== "overview")
              .map((key) => (
                <Link href={`/admin/${key}`} key={key}>
                  <strong>{t(`nav.${key}`)}</strong>
                  <span className="small muted">
                    {t(`descriptions.${key}`)}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      </div>
      <section className="card stack">
        <h2>{t("operations")}</h2>
        <p className="small muted">{t("metricNotes")}</p>
        <p>
          {t("video")}:{" "}
          {current.usage
            ? t("videoValue", {
                month: current.usage.month,
                gb: format.number(current.usage.gb, {
                  maximumFractionDigits: 2,
                }),
              })
            : t("unavailable")}
        </p>
        <p>
          {t("heartbeat")}:{" "}
          {current.heartbeat
            ? format.dateTime(current.heartbeat, {
                timeZone: profile.timezone,
                dateStyle: "medium",
                timeStyle: "short",
              })
            : t("unavailable")}
        </p>
      </section>
    </AdminFrame>
  );
}
