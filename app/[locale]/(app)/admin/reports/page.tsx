// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { reports } from "@/src/lib/admin/queries";
import { REPORT_REASONS } from "@/src/lib/safety";
import { Link } from "@/src/i18n/navigation";
import { ListFilter, listQuery } from "../list-filter";
import { AdminFrame } from "../frame";
import { ActionForm } from "../action-form";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const q = listQuery(await searchParams);
  const { profile } = await requireAdmin();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const [open, resolved] = await Promise.all([
    reports(false, q),
    reports(true, q),
  ]);
  return (
    <AdminFrame section="reports">
      <ListFilter q={q} />
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
                      <td data-label={t("columns.reporter")}>{reporter}</td>
                      <td data-label={t("columns.target")}>
                        {username ? (
                          <Link href={`/u/${username}`}>{target}</Link>
                        ) : (
                          target
                        )}
                      </td>
                      <td data-label={t("columns.reason")}>
                        {REPORT_REASONS.some(
                          (reason) => reason === report.reason,
                        )
                          ? t(`reasons.${report.reason}`)
                          : t("reasons.other")}
                      </td>
                      <td
                        data-label={t("columns.details")}
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          minWidth: "12rem",
                        }}
                      >
                        {report.details}
                      </td>
                      <td data-label={t("columns.session")}>
                        {report.sessionId || t("unavailable")}
                      </td>
                      <td data-label={t("columns.reports30")}>{recent}</td>
                      <td data-label={t("columns.status")}>
                        <span
                          className={`badge ${report.status === "open" ? "warm" : ""}`}
                        >
                          {t(`reportStatus.${report.status}`)}
                        </span>
                      </td>
                      <td data-label={t("columns.actions")}>
                        {section.open && (
                          <div className="stack-sm">
                            {report.postId && (
                              <ActionForm
                                fields={{
                                  intent: "postDelete",
                                  id: report.postId,
                                }}
                                label={t("removePost")}
                                danger
                              />
                            )}
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
