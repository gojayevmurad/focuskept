// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { ADMIN_ALERT_EVENTS } from "@/src/lib/db/schema";
import { getAdminAlertPreferences } from "@/src/lib/admin/alerts";
import { waitingInstantMatches } from "@/src/lib/matching/instant";
import { Avatar } from "@/src/components/avatar";
import { Link } from "@/src/i18n/navigation";
import { AdminFrame } from "../frame";
import { saveAlertPreferences } from "./actions";
import { TestButton } from "./test-button";
import styles from "./notifications.module.css";

export default async function Page() {
  const { user } = await requireAdmin();
  const [t, prefs, waiting] = await Promise.all([
    getTranslations("admin.notifications"),
    getAdminAlertPreferences(user.id),
    waitingInstantMatches(),
  ]);
  return (
    <AdminFrame section="notifications">
      <div className={styles.header}>
        <p className="muted">{t("lead")}</p>
        <TestButton />
      </div>
      <form action={saveAlertPreferences} className={styles.preferences}>
        <h2>{t("emailTitle")}</h2>
        <p className="muted">{t("defaultEnabled")}</p>
        {ADMIN_ALERT_EVENTS.map((event) => (
          <label className={styles.preference} key={event}>
            <span>
              <strong>{t(`events.${event}.title`)}</strong>
              <span className="small muted">
                {t(`events.${event}.description`)}
              </span>
            </span>
            <input
              type="checkbox"
              name={event}
              defaultChecked={prefs[event] ?? true}
            />
          </label>
        ))}
        <button className="button" type="submit">
          {t("save")}
        </button>
      </form>
      <section className={styles.preferences}>
        <h2>{t("waitingTitle")}</h2>
        {waiting.length ? (
          waiting.map((request) => (
            <div className={styles.waiting} key={request.id}>
              <Avatar name={request.name} src={request.avatarUrl} />
              <span>
                <strong>{request.name}</strong>
                <span className="small muted">
                  {t("waitingDuration", { duration: request.durationMin })}
                </span>
              </span>
              <Link
                className="button secondary"
                href={`/match-now/join/${request.id}`}
                prefetch={false}
              >
                {t("join")}
              </Link>
            </div>
          ))
        ) : (
          <p className="muted">{t("noWaiting")}</p>
        )}
      </section>
    </AdminFrame>
  );
}
