// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { currentMetrics, periodMetrics } from "@/src/lib/admin/metrics";
import { AdminFrame } from "./frame";

export default async function Page() {
  const { profile } = await requireAdmin();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const [week, month, current] = await Promise.all([
    periodMetrics(7),
    periodMetrics(30),
    currentMetrics(),
  ]);
  const usage = current.usage;
  const video =
    typeof usage === "object" &&
    usage !== null &&
    "month" in usage &&
    "gb" in usage &&
    typeof usage.month === "string" &&
    typeof usage.gb === "number"
      ? t("videoValue", {
          month: usage.month,
          gb: format.number(usage.gb, { maximumFractionDigits: 2 }),
        })
      : t("unavailable");
  const metrics = [
    "signups",
    "bookings",
    "completed",
    "matchRate",
    "noShowRate",
    "lateCancels",
  ] as const;
  return (
    <AdminFrame section="overview">
      {[
        { days: 7, data: week },
        { days: 30, data: month },
      ].map(({ days, data }) => (
        <section className="stack" key={days}>
          <h2>{t("period", { days })}</h2>
          <div className="grid-3">
            {metrics.map((key) => (
              <div className="card stat" key={key}>
                <span>{t(`metrics.${key}`)}</span>
                <strong>
                  {key === "matchRate" || key === "noShowRate"
                    ? format.number(data[key], {
                        style: "percent",
                        maximumFractionDigits: 1,
                      })
                    : format.number(data[key])}
                </strong>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="small muted">{t("metricNotes")}</p>
      <section className="grid-3">
        {(["plus", "reports", "hosts"] as const).map((key) => (
          <div className="card stat" key={key}>
            <span>{t(`metrics.${key}`)}</span>
            <strong>{format.number(current[key])}</strong>
          </div>
        ))}
      </section>
      <section className="card stack">
        <h2>{t("operations")}</h2>
        <p>
          {t("video")}: {video}
        </p>
        <p>
          {t("heartbeat")}:{" "}
          {current.heartbeat
            ? format.dateTime(current.heartbeat, {
                timeZone: profile.timezone,
                dateStyle: "medium",
                timeStyle: "long",
              })
            : t("unavailable")}
        </p>
      </section>
    </AdminFrame>
  );
}
