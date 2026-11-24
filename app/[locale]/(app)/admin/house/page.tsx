// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { houseSlots, ownHouseBookings } from "@/src/lib/admin/queries";
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
  const { user, profile } = await requireAdmin();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const [allSlots, own] = await Promise.all([
    houseSlots(),
    ownHouseBookings(user.id),
  ]);
  const slots = allSlots.filter(
    (slot) =>
      slot.name?.toLocaleLowerCase().includes(q.toLocaleLowerCase()) || !q,
  );
  const date = (value: Date) =>
    format.dateTime(value, {
      timeZone: profile.timezone,
      dateStyle: "medium",
      timeStyle: "short",
    });
  return (
    <AdminFrame section="house">
      <ListFilter q={q} />
      <p>{t("houseHelp", { timezone: profile.timezone })}</p>
      {!profile.isHouse && (
        <p className="notice warn">
          {t("houseRequired")} <Link href="/admin/users">{t("nav.users")}</Link>
        </p>
      )}
      <section className="stack">
        <h2>{t("waitingSlots")}</h2>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t("waitingSlots")}</caption>
            <thead>
              <tr>
                {["slot", "duration", "waiting", "actions"].map((key) => (
                  <th scope="col" key={key}>
                    {t(`columns.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={`${slot.startAt.toISOString()}:${slot.durationMin}`}>
                  <th scope="row">{date(slot.startAt)}</th>
                  <td data-label={t("columns.duration")}>
                    {t("minutes", { count: slot.durationMin })}
                  </td>
                  <td data-label={t("columns.waiting")}>
                    {slot.name || t("unavailable")}
                  </td>
                  <td data-label={t("columns.actions")}>
                    {profile.isHouse && slot.userId !== user.id && (
                      <ActionForm
                        fields={{
                          intent: "house",
                          startAt: slot.startAt.toISOString(),
                          durationMin: slot.durationMin,
                        }}
                        label={t("bookHouse")}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {!slots.length && (
                <tr>
                  <td colSpan={4}>{t("empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card stack">
        <h2>{t("ownHouseBookings")}</h2>
        <p className="small muted">{t("houseBookingNote")}</p>
        <div className="list">
          {own.map((row) => (
            <div className="list-item" key={row.id}>
              <span className="grow">
                {date(row.startAt)} · {t("minutes", { count: row.durationMin })}
              </span>
              <span className="badge">{t(`bookingStatus.${row.status}`)}</span>
              {row.sessionId && (
                <Link
                  className="button secondary small"
                  href={`/session/${row.sessionId}`}
                >
                  {t("openSession")}
                </Link>
              )}
            </div>
          ))}
          {!own.length && <p>{t("empty")}</p>}
        </div>
      </section>
    </AdminFrame>
  );
}
