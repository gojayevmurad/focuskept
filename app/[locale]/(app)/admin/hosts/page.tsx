// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { hosts } from "@/src/lib/admin/queries";
import { Link } from "@/src/i18n/navigation";
import { AdminFrame } from "../frame";
import { ActionForm } from "../action-form";

function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export default async function Page() {
  const { profile } = await requireAdmin();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const rows = await hosts();
  return (
    <AdminFrame section="hosts">
      {[true, false].map((applications) => (
        <section className="stack" key={String(applications)}>
          <h2>{t(applications ? "applications" : "approvedHosts")}</h2>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">
                {t(applications ? "applications" : "approvedHosts")}
              </caption>
              <thead>
                <tr>
                  {(applications
                    ? ["name", "pitch", "audience", "completed", "actions"]
                    : [
                        "name",
                        "rating",
                        "hosted",
                        "perkUntil",
                        "status",
                        "actions",
                      ]
                  ).map((key) => (
                    <th scope="col" key={key}>
                      {t(`columns.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) =>
                    applications
                      ? r.host.status === "applied"
                      : r.host.status !== "applied",
                  )
                  .map(({ host, name, username, completed }) => (
                    <tr key={host.userId}>
                      <th scope="row">
                        {username ? (
                          <Link href={`/u/${username}`}>{name}</Link>
                        ) : (
                          name
                        )}
                      </th>
                      {applications ? (
                        <>
                          <td
                            style={{
                              whiteSpace: "pre-wrap",
                              minWidth: "12rem",
                            }}
                          >
                            {host.pitch}
                          </td>
                          <td>
                            {safeUrl(host.audienceUrl) ? (
                              <a
                                href={safeUrl(host.audienceUrl)!}
                                target="_blank"
                                rel="nofollow noopener"
                              >
                                {host.audienceUrl}
                              </a>
                            ) : (
                              host.audienceUrl || t("unavailable")
                            )}
                          </td>
                          <td>{completed}</td>
                          <td>
                            <div className="stack-sm">
                              <ActionForm
                                fields={{
                                  intent: "host",
                                  id: host.userId,
                                  operation: "approve",
                                }}
                                label={t("approve")}
                              />
                              <ActionForm
                                fields={{
                                  intent: "host",
                                  id: host.userId,
                                  operation: "reject",
                                }}
                                label={t("reject")}
                                danger
                              />
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            {host.rating === null
                              ? t("unavailable")
                              : format.number(host.rating, {
                                  maximumFractionDigits: 1,
                                })}
                          </td>
                          <td>{host.sessionsHosted}</td>
                          <td>
                            {host.perkUntil
                              ? format.dateTime(host.perkUntil, {
                                  timeZone: profile.timezone,
                                  dateStyle: "medium",
                                })
                              : t("unavailable")}
                          </td>
                          <td>{t(`hostStatus.${host.status}`)}</td>
                          <td>
                            <ActionForm
                              fields={{
                                intent: "host",
                                id: host.userId,
                                operation:
                                  host.status === "suspended"
                                    ? "unsuspend"
                                    : "suspend",
                              }}
                              label={t(
                                host.status === "suspended"
                                  ? "unsuspend"
                                  : "suspend",
                              )}
                              danger={host.status !== "suspended"}
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                {!rows.some((r) =>
                  applications
                    ? r.host.status === "applied"
                    : r.host.status !== "applied",
                ) && (
                  <tr>
                    <td colSpan={applications ? 5 : 6}>{t("empty")}</td>
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
