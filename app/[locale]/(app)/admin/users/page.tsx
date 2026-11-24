// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { searchUsers } from "@/src/lib/admin/queries";
import { Link } from "@/src/i18n/navigation";
import { AdminFrame } from "../frame";
import { ActionForm } from "../action-form";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const current = await requireAdmin();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const query = (await searchParams).q;
  const q = (typeof query === "string" ? query : "").trim().slice(0, 200);
  const rows = await searchUsers(q);
  return (
    <AdminFrame section="users">
      <form className="row" method="get">
        <label className="field grow">
          <span>{t("search")}</span>
          <input
            className="input"
            name="q"
            defaultValue={q}
            maxLength={200}
            placeholder={t("userSearchPlaceholder")}
          />
        </label>
        <button className="button">{t("searchButton")}</button>
      </form>
      <p className="small muted">{t("userLimit")}</p>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">{t("nav.users")}</caption>
          <thead>
            <tr>
              {[
                "name",
                "email",
                "username",
                "created",
                "role",
                "flags",
                "completed",
                "actions",
              ].map((key) => (
                <th scope="col" key={key}>
                  {t(`columns.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user, profile, completed }) => (
              <tr key={user.id}>
                <th scope="row">{profile?.displayName || user.name}</th>
                <td data-label={t("columns.email")}>{user.email}</td>
                <td data-label={t("columns.username")}>
                  {profile ? (
                    <Link href={`/u/${profile.username}`}>
                      @{profile.username}
                    </Link>
                  ) : (
                    t("unavailable")
                  )}
                </td>
                <td data-label={t("columns.created")}>
                  {format.dateTime(user.createdAt, {
                    timeZone: current.profile.timezone,
                    dateStyle: "medium",
                  })}
                </td>
                <td data-label={t("columns.role")}>
                  {profile?.role === "admin"
                    ? t("roles.admin")
                    : t("roles.user")}
                </td>
                <td data-label={t("columns.flags")}>
                  <div className="stack-sm">
                    {profile?.suspendedAt && (
                      <span className="badge danger">{t("suspended")}</span>
                    )}
                    {profile?.isHouse && (
                      <span className="badge accent">{t("houseAccount")}</span>
                    )}
                  </div>
                </td>
                <td data-label={t("columns.completed")}>
                  {format.number(completed)}
                </td>
                <td data-label={t("columns.actions")}>
                  {profile ? (
                    <div className="stack-sm">
                      <ActionForm
                        fields={{
                          intent: "user",
                          id: user.id,
                          operation: profile.suspendedAt
                            ? "unsuspend"
                            : "suspend",
                        }}
                        label={t(profile.suspendedAt ? "unsuspend" : "suspend")}
                        danger={!profile.suspendedAt}
                      />
                      <ActionForm
                        fields={{
                          intent: "user",
                          id: user.id,
                          operation:
                            profile.role === "admin"
                              ? "removeAdmin"
                              : "makeAdmin",
                        }}
                        label={t(
                          profile.role === "admin"
                            ? "removeAdmin"
                            : "makeAdmin",
                        )}
                        disabled={
                          profile.role === "admin" &&
                          user.id === current.user.id
                        }
                      />
                      <ActionForm
                        fields={{
                          intent: "user",
                          id: user.id,
                          operation: profile.isHouse ? "houseOff" : "houseOn",
                        }}
                        label={t(profile.isHouse ? "houseOff" : "houseOn")}
                      />
                    </div>
                  ) : (
                    t("noProfile")
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8}>{t("empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminFrame>
  );
}
