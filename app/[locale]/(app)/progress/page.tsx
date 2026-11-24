// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { userStats } from "@/src/lib/growth/stats";
import { localDayKey } from "@/src/lib/scheduling/slots";
import { Link } from "@/src/i18n/navigation";
import { ShareCards } from "./share-cards";
import styles from "./progress.module.css";

export const metadata: Metadata = { title: "Progress" };

export default async function Page() {
  const { user, profile } = await requireAppUser();
  const t = await getTranslations("progress");
  const common = await getTranslations("common");
  const book = await getTranslations("book");
  const format = await getFormatter();
  const stats = await userStats(user.id, profile.timezone);
  // Work with calendar dates in UTC after resolving the user's local day.
  // Advancing a calendar day must not repeat or skip dates at DST boundaries.
  const todayKey = localDayKey(new Date(), profile.timezone);
  const today = new Date(`${todayKey}T12:00:00Z`);
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - 77);
  const weeks = Array.from({ length: 12 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + week * 7 + day);
      const key = date.toISOString().slice(0, 10);
      return { date, key, minutes: stats.days[key] ?? 0 };
    }),
  );
  const level = (m: number) =>
    m === 0 ? 0 : m < 50 ? 1 : m < 100 ? 2 : m < 150 ? 3 : 4;
  const summary = t("thisMonth", {
    hours: stats.monthHours,
    sessions: stats.monthSessions,
  });
  return (
    <AppShell title={t("title")}>
      <div className={styles.page}>
        <div className={`page-title ${styles.header}`}>
          <h1>{t("title")}</h1>
          <p className="muted">{t("lead")}</p>
        </div>
        <dl className={styles.stats}>
          {[
            {
              label: t("dailyStreak"),
              value: stats.dailyStreak,
              hint: t("longest", { n: stats.longestStreak }),
            },
            {
              label: t("weeklyStreak"),
              value: stats.weeklyStreak,
              hint: t("weeks"),
            },
            {
              label: t("totalHours"),
              value: stats.hours,
              hint: t("sessions", { n: stats.sessions }),
            },
          ].map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>
                <strong>{format.number(stat.value)}</strong>
                <span>{stat.hint}</span>
              </dd>
            </div>
          ))}
        </dl>
        <section className="card stack">
          <h2>{t("activity")}</h2>
          <table className={styles.activity}>
            <caption className="sr-only">{t("activityLabel")}</caption>
            <thead>
              <tr>
                <td />
                {weeks[0].map((day) => (
                  <th scope="col" key={day.key}>
                    <abbr
                      title={format.dateTime(day.date, {
                        timeZone: "UTC",
                        weekday: "long",
                      })}
                    >
                      {format.dateTime(day.date, {
                        timeZone: "UTC",
                        weekday: "short",
                      })}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, index) => (
                <tr key={week[0].key}>
                  <th scope="row">
                    <span className="sr-only">
                      {format.dateTime(week[0].date, {
                        timeZone: "UTC",
                        dateStyle: "long",
                      })}
                    </span>
                    <span aria-hidden="true">
                      {(index === 0 ||
                        week[0].date.getUTCMonth() !==
                          weeks[index - 1][0].date.getUTCMonth()) && (
                        <span className={styles.month}>
                          {format.dateTime(week[0].date, {
                            timeZone: "UTC",
                            month: "short",
                          })}
                        </span>
                      )}
                      {format.dateTime(week[0].date, {
                        timeZone: "UTC",
                        day: "numeric",
                      })}
                    </span>
                  </th>
                  {week.map((day) => {
                    const future = day.key > todayKey;
                    const label = `${format.dateTime(day.date, { timeZone: "UTC", dateStyle: "full" })}: ${common("minutes", { count: day.minutes })}${day.key === todayKey ? `, ${book("today")}` : ""}`;
                    return (
                      <td key={day.key}>
                        <span
                          className={styles.tile}
                          data-level={level(day.minutes)}
                          data-today={day.key === todayKey}
                          data-future={future}
                          title={future ? undefined : label}
                        >
                          {!future && (
                            <>
                              <span aria-hidden="true">
                                {format.number(day.date.getUTCDate())}
                              </span>
                              <span className="sr-only">{label}</span>
                            </>
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.legend}>
            {["0", "1–49", "50–99", "100–149", "150+"].map((range, i) => (
              <span key={range}>
                <i data-level={i} aria-hidden="true" />
                {common("minutes", { count: range })}
              </span>
            ))}
            <span>
              <i data-today="true" aria-hidden="true" />
              {book("today")}
            </span>
          </div>
          <p className="small muted">{summary}</p>
        </section>
        <section className="card stack">
          <h2>{t("share")}</h2>
          {profile.statsPublic ? (
            <ShareCards username={profile.username} />
          ) : (
            <p className="muted small">
              {t("sharePrivate")}{" "}
              <Link href="/settings" className="link">
                {t("openSettings")}
              </Link>
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
