// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { groups } from "@/src/lib/admin/queries";
import { Link } from "@/src/i18n/navigation";
import { AdminFrame } from "../frame";
import { ActionForm } from "../action-form";

export default async function Page() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const rows = await groups();
  return (
    <AdminFrame section="groups">
      <p className="notice">{t("licenseHelp")}</p>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">{t("nav.groups")}</caption>
          <thead>
            <tr>
              {[
                "name",
                "members",
                "owner",
                "plusSeats",
                "licenseUntil",
                "actions",
              ].map((key) => (
                <th scope="col" key={key}>
                  {t(`columns.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ community, owner, members }) => (
              <tr key={community.id}>
                <th scope="row">
                  <Link href={`/groups/${community.slug}`}>
                    {community.name}
                  </Link>
                </th>
                <td>{members}</td>
                <td>{owner || t("unavailable")}</td>
                <td>{community.plusSeats}</td>
                <td>
                  {community.licenseUntil?.toISOString().slice(0, 10) ||
                    t("unavailable")}
                </td>
                <td>
                  <div className="stack">
                    <ActionForm
                      fields={{ intent: "groupSave", id: community.id }}
                      label={t("save")}
                    >
                      <label className="field">
                        <span>{t("columns.plusSeats")}</span>
                        <input
                          name="plusSeats"
                          type="number"
                          min={0}
                          max={10000}
                          step={1}
                          defaultValue={community.plusSeats}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>{t("columns.licenseUntil")}</span>
                        <input
                          name="licenseUntil"
                          type="date"
                          defaultValue={
                            community.licenseUntil
                              ?.toISOString()
                              .slice(0, 10) ?? ""
                          }
                        />
                      </label>
                    </ActionForm>
                    <ActionForm
                      fields={{ intent: "groupDelete", id: community.id }}
                      label={t("delete")}
                      danger
                    >
                      <label className="field">
                        <span>{t("confirmDelete")}</span>
                        <input
                          name="confirm"
                          required
                          pattern="DELETE"
                          autoComplete="off"
                        />
                      </label>
                    </ActionForm>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6}>{t("empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminFrame>
  );
}
