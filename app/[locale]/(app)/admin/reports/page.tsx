// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { reports } from "@/src/lib/admin/queries";
import { REPORT_REASONS } from "@/src/lib/safety";
import { Link } from "@/src/i18n/navigation";
import { AdminFrame } from "../frame";
import { ActionForm } from "../action-form";

export default async function Page() {
  const { profile } = await requireAdmin();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const [open, resolved] = await Promise.all([reports(false), reports(true)]);
  return (
    <AdminFrame section="reports">
      {[
        { title: "openReports", rows: open, open: true },
        { title: "resolvedReports", rows: resolved, open: false },
      ].map((section) => (
        <section className="stack" key={section.title}>
          <h2>{t(section.title)}</h2>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t(section.title)}</caption>
              <thead>
                <tr>
                  {[
                    "created",
                    "reporter",
                    "target",
                    "reason",
                    "details",
                    "session",
                    "reports30",
                    "status",
                    "actions",
                  ].map((key) => (
                    <th scope="col" key={key}>
                      {t(`columns.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map(
                  ({ report, reporter, target, username, recent }) => (
                    <tr key={report.id}>
                      <th scope="row">
                        {format.dateTime(report.createdAt, {
                          timeZone: profile.timezone,
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </th>
                      <td>{reporter}</td>
                      <td>
                        {username ? (
                          <Link href={`/u/${username}`}>{target}</Link>
                        ) : (
                          target
                        )}
                      </td>
                      <td>
                        {REPORT_REASONS.some(
                          (reason) => reason === report.reason,
                        )
                          ? t(`reasons.${report.reason}`)
                          : t("reasons.other")}
                      </td>
                      <td
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          minWidth: "12rem",
                        }}
                      >
                        {report.details}
                      </td>
                      <td>{report.sessionId || t("unavailable")}</td>
                      <td>{recent}</td>
                      <td>
                        <span
                          className={`badge ${report.status === "open" ? "warm" : ""}`}
                        >
                          {t(`reportStatus.${report.status}`)}
                        </span>
                      </td>
                      <td>
                        {section.open && (
                          <div className="stack-sm">
                            <ActionForm
                              fields={{
                                intent: "report",
                                id: report.id,
                                operation: "dismiss",
                              }}
                              label={t("dismiss")}
                            />
                            <ActionForm
                              fields={{
                                intent: "report",
                                id: report.id,
                                operation: "action",
                              }}
                              label={t("suspendTarget")}
                              danger
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ),
                )}
                {!section.rows.length && (
                  <tr>
                    <td colSpan={9}>{t("empty")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </AdminFrame>
  );
}
