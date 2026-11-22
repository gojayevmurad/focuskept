// SPDX-License-Identifier: AGPL-3.0-only
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { Link } from "@/src/i18n/navigation";
import { getSupportTicket } from "@/src/lib/support/admin";
import { AdminFrame } from "../frame";
import { updateTicketNoteAction, updateTicketStatusAction } from "./actions";
import styles from "./support.module.css";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireAdmin();
  const t = await getTranslations("admin.support");
  const format = await getFormatter();
  const { id } = await params;

  const ticket = await getSupportTicket(id);
  if (!ticket) notFound();

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

  const mailtoSubject = encodeURIComponent(`Re: ${ticket.subject}`);
  const mailtoUrl = `mailto:${ticket.email}?subject=${mailtoSubject}`;

  return (
    <AdminFrame section="support">
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/support" className="button small secondary">
          ← {t("backToList")}
        </Link>
      </div>

      <article className={styles.detailCard}>
        <header className={styles.detailHeader}>
          <div>
            <h2>{ticket.subject}</h2>
            <div className="small muted">ID: {ticket.id}</div>
          </div>
          <div className="row">
            <span className={statusClass(ticket.status)}>
              {t(`status.${ticket.status}`)}
            </span>
            <span className="badge">{t(`category.${ticket.category}`)}</span>
          </div>
        </header>

        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>{t("fromLabel")}</span>
            <span className={styles.metaValue}>{ticket.name}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>{t("emailLabel")}</span>
            <span className={styles.metaValue}>
              <a href={mailtoUrl}>{ticket.email}</a>
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>{t("userLabel")}</span>
            <span className={styles.metaValue}>
              {ticket.username ? (
                <Link href={`/u/${ticket.username}`}>
                  @{ticket.username} ({ticket.displayName})
                </Link>
              ) : (
                t("guestUser")
              )}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>{t("dateLabel")}</span>
            <span className={styles.metaValue}>
              {format.dateTime(ticket.createdAt, {
                dateStyle: "medium",
                timeStyle: "medium",
                timeZone: profile.timezone,
              })}
            </span>
          </div>
          {ticket.answeredAt ? (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{t("answeredLabel")}</span>
              <span className={styles.metaValue}>
                {format.dateTime(ticket.answeredAt, {
                  dateStyle: "medium",
                  timeStyle: "medium",
                  timeZone: profile.timezone,
                })}
              </span>
            </div>
          ) : null}
          {ticket.pageUrl ? (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{t("pageUrlLabel")}</span>
              <span
                className={styles.metaValue}
                style={{ overflowWrap: "anywhere" }}
              >
                {ticket.pageUrl}
              </span>
            </div>
          ) : null}
        </div>

        <div className={styles.messageSection}>
          <span className={styles.metaLabel}>{t("messageLabel")}</span>
          <div className={styles.messageBody}>{ticket.message}</div>
        </div>

        <div className={styles.actionsBar}>
          <a href={mailtoUrl} className="button">
            ✉ {t("replyByEmail")}
          </a>

          <form action={updateTicketStatusAction} className="row">
            <input type="hidden" name="id" value={ticket.id} />
            <select
              name="status"
              className={styles.select}
              defaultValue={ticket.status}
              aria-label={t("changeStatus")}
            >
              <option value="open">{t("status.open")}</option>
              <option value="answered">{t("status.answered")}</option>
              <option value="closed">{t("status.closed")}</option>
              <option value="spam">{t("status.spam")}</option>
            </select>
            <button type="submit" className="button secondary small">
              {t("changeStatus")}
            </button>
          </form>
        </div>
      </article>

      <section className={styles.noteSection}>
        <h3>{t("adminNotesLabel")}</h3>
        <form action={updateTicketNoteAction} className="stack-sm">
          <input type="hidden" name="id" value={ticket.id} />
          <textarea
            name="adminNote"
            className={styles.noteTextarea}
            defaultValue={ticket.adminNote}
            placeholder={t("adminNotesPlaceholder")}
          />
          <div>
            <button type="submit" className="button secondary small">
              {t("saveNote")}
            </button>
          </div>
        </form>
      </section>
    </AdminFrame>
  );
}
