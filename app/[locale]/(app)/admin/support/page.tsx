// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { Link } from "@/src/i18n/navigation";
import {
  getSupportTickets,
  getSupportTicketCounts,
} from "@/src/lib/support/admin";
import { SUPPORT_CATEGORIES } from "@/src/lib/support/validation";
import { listQuery } from "../list-filter";
import { AdminFrame } from "../frame";
import styles from "./support.module.css";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const { profile } = await requireAdmin();
  const t = await getTranslations("admin.support");
  const format = await getFormatter();
  const params = await searchParams;

  const q = listQuery(params);
  const currentStatus = params.status || "all";
  const currentCategory = params.category || "all";

  const [allTickets, counts] = await Promise.all([
    getSupportTickets({
      status: currentStatus,
      category: currentCategory,
    }),
    getSupportTicketCounts(),
  ]);

  const tickets = allTickets.filter((ticket) =>
    `${ticket.subject} ${ticket.name} ${ticket.email}`
      .toLocaleLowerCase()
      .includes(q.toLocaleLowerCase()),
  );
  const statusClass = (status: string) => {
    switch (status) {
      case "open":
        return styles.badgeOpen;
      case "answered":
        return styles.badgeAnswered;
      case "closed":
        return styles.badgeClosed;
      case "spam":
        return styles.badgeSpam;
      default:
        return "";
    }
  };

  return (
    <AdminFrame section="support">
      <div className={styles.header}>
        <div>
          <h2>{t("title")}</h2>
          <p className="small muted">{t("lead")}</p>
        </div>
      </div>

      <div className={styles.countsGrid}>
        <div className={styles.countCard}>
          <span className={styles.countLabel}>{t("allStatuses")}</span>
          <span className={styles.countValue}>
            {format.number(counts.total)}
          </span>
        </div>
        <div className={styles.countCard}>
          <span className={styles.countLabel}>{t("status.open")}</span>
          <span className={styles.countValue}>
            {format.number(counts.open)}
          </span>
        </div>
        <div className={styles.countCard}>
          <span className={styles.countLabel}>{t("status.answered")}</span>
          <span className={styles.countValue}>
            {format.number(counts.answered)}
          </span>
        </div>
        <div className={styles.countCard}>
          <span className={styles.countLabel}>{t("status.closed")}</span>
          <span className={styles.countValue}>
            {format.number(counts.closed)}
          </span>
        </div>
        <div className={styles.countCard}>
          <span className={styles.countLabel}>{t("status.spam")}</span>
          <span className={styles.countValue}>
            {format.number(counts.spam)}
          </span>
        </div>
      </div>

      <form method="GET" className={styles.filterBar}>
        <label className="field">
          {t("search")}
          <input
            name="q"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            maxLength={200}
          />
        </label>
        <div className={styles.filterGroup}>
          <label htmlFor="filter-status">{t("filterStatus")}:</label>
          <select
            id="filter-status"
            name="status"
            className={styles.select}
            defaultValue={currentStatus}
          >
            <option value="all">{t("allStatuses")}</option>
            <option value="open">{t("status.open")}</option>
            <option value="answered">{t("status.answered")}</option>
            <option value="closed">{t("status.closed")}</option>
            <option value="spam">{t("status.spam")}</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="filter-category">{t("filterCategory")}:</label>
          <select
            id="filter-category"
            name="category"
            className={styles.select}
            defaultValue={currentCategory}
          >
            <option value="all">{t("allCategories")}</option>
            {SUPPORT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`category.${cat}`)}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="button small secondary">
          {t("applyFilter")}
        </button>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t("dateLabel")}</th>
              <th scope="col">{t("statusLabel")}</th>
              <th scope="col">{t("categoryLabel")}</th>
              <th scope="col">{t("fromLabel")}</th>
              <th scope="col">{t("subjectLabel")}</th>
              <th scope="col">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32 }}>
                  {t("noTickets")}
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td data-label={t("dateLabel")}>
                    {format.dateTime(ticket.createdAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: profile.timezone,
                    })}
                  </td>
                  <td data-label={t("statusLabel")}>
                    <span className={statusClass(ticket.status)}>
                      {t(`status.${ticket.status}`)}
                    </span>
                  </td>
                  <td data-label={t("categoryLabel")}>
                    <span className="badge">
                      {t(`category.${ticket.category}`)}
                    </span>
                  </td>
                  <td data-label={t("fromLabel")}>
                    <div>
                      <strong>{ticket.name}</strong>
                      <div className="small muted">{ticket.email}</div>
                    </div>
                  </td>
                  <td data-label={t("subjectLabel")}>
                    <Link
                      href={`/admin/support/${ticket.id}`}
                      style={{ fontWeight: 600, color: "var(--accent)" }}
                    >
                      {ticket.subject}
                    </Link>
                  </td>
                  <td data-label={t("actions")}>
                    <Link
                      href={`/admin/support/${ticket.id}`}
                      className="button small secondary"
                    >
                      {t("viewTicket")}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminFrame>
  );
}
