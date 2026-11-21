// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { userStats } from "@/src/lib/growth/stats";
import { localDayKey } from "@/src/lib/scheduling/slots";
import { Link } from "@/src/i18n/navigation";
import { ShareCards } from "./share-cards";

export const metadata: Metadata = { title: "Progress" };

export default async function Page() {
  const { user, profile } = await requireAppUser();
  const t = await getTranslations("progress");
  const stats = await userStats(user.id, profile.timezone);
  // 12 weeks of days, Monday first, oldest at the left.
  const today = new Date();
  const days: { key: string; minutes: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const key = localDayKey(
      new Date(today.getTime() - i * 86_400_000),
      profile.timezone,
    );
    days.push({ key, minutes: stats.days[key] ?? 0 });
  }
  const level = (m: number) =>
    m === 0 ? 0 : m < 50 ? 1 : m < 100 ? 2 : m < 150 ? 3 : 4;
  return (
    <AppShell title={t("title")}>
      <div className="page-title">
        <h1>{t("title")}</h1>
        <p className="muted">{t("lead")}</p>
      </div>
      <div className="grid-3">
        <div className="card stat">
          <span className="muted small">{t("dailyStreak")}</span>
          <strong>{stats.dailyStreak}</strong>
          <span className="small faint">
            {t("longest", { n: stats.longestStreak })}
          </span>
        </div>
        <div className="card stat">
          <span className="muted small">{t("weeklyStreak")}</span>
          <strong>{stats.weeklyStreak}</strong>
          <span className="small faint">{t("weeks")}</span>
        </div>
        <div className="card stat">
          <span className="muted small">{t("totalHours")}</span>
          <strong>{stats.hours}</strong>
          <span className="small faint">
            {t("sessions", { n: stats.sessions })}
          </span>
        </div>
      </div>
      <section className="card stack">
        <h2>{t("activity")}</h2>
        <div
          role="img"
          aria-label={t("activityLabel")}
          style={{
            display: "grid",
            gridTemplateRows: "repeat(7, 14px)",
            gridAutoFlow: "column",
            gridAutoColumns: "14px",
            gap: 4,
            overflowX: "auto",
          }}
        >
          {days.map((d) => (
            <span
              key={d.key}
              title={`${d.key}: ${d.minutes} min`}
              style={{
                borderRadius: 3,
                background: [
                  "var(--surface-2)",
                  "color-mix(in srgb, var(--accent), transparent 70%)",
                  "color-mix(in srgb, var(--accent), transparent 45%)",
                  "color-mix(in srgb, var(--accent), transparent 20%)",
                  "var(--accent)",
                ][level(d.minutes)],
              }}
            />
          ))}
        </div>
        <p className="small faint">
          {t("thisMonth", {
            hours: stats.monthHours,
            sessions: stats.monthSessions,
          })}
        </p>
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
    </AppShell>
  );
}
