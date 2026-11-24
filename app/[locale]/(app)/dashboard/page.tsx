// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { Avatar } from "@/src/components/avatar";
import { MatchNow } from "@/src/components/match-now";
import { WelcomeFlow } from "@/src/components/tour";
import { requireAppUser } from "@/src/lib/app-user";
import { getAppConfig } from "@/src/config/app";
import { upcomingBookings } from "@/src/lib/bookings/service";
import { userStats } from "@/src/lib/growth/stats";
import { getFocusPreferences } from "@/src/lib/profiles";
import { welcomePhase } from "@/src/lib/profiles/onboarding";
import { firstName } from "@/src/lib/profiles/rules";
import { db } from "@/src/lib/db";
import { profile, sessionParticipant } from "@/src/lib/db/schema";
import { Link } from "@/src/i18n/navigation";
import { peoplePage, peopleParameters } from "../people/queries";
import { SessionHero } from "./session-hero";
import { FirstRunGuide } from "./first-run-guide";
import { dashboardState } from "./state";
import { FallbackCard } from "./fallback-card";
import styles from "./dashboard.module.css";
export const metadata: Metadata = { title: "Home" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; tour?: string }>;
}) {
  const { user, profile: me } = await requireAppUser();
  const { welcome, tour } = await searchParams;
  const [t, c, focus, format, upcoming, stats, prefs, recent] =
    await Promise.all([
      getTranslations("dashboard"),
      getTranslations("common"),
      getTranslations("onboarding.flow"),
      getFormatter(),
      upcomingBookings(user.id),
      userStats(user.id, me.timezone),
      getFocusPreferences(user.id),
      peoplePage(user.id, peopleParameters({}), 6),
    ]);
  const ids = upcoming.flatMap((b) => (b.sessionId ? [b.sessionId] : []));
  const partners = ids.length
    ? await db()
        .select({
          sessionId: sessionParticipant.sessionId,
          name: profile.displayName,
          avatar: profile.avatarUrl,
          goal: sessionParticipant.goalText,
          profileGoal: profile.goal,
        })
        .from(sessionParticipant)
        .innerJoin(profile, eq(profile.userId, sessionParticipant.userId))
        .where(
          and(
            inArray(sessionParticipant.sessionId, ids),
            ne(sessionParticipant.userId, user.id),
          ),
        )
    : [];
  const bookings = upcoming.map((b) => ({
    ...b,
    startAt: b.startAt.toISOString(),
    partner: (() => {
      const p = partners.find((p) => p.sessionId === b.sessionId);
      return p ? { ...p, goal: p.goal ?? p.profileGoal } : null;
    })(),
  }));
  const now = new Date().getTime();
  const state = dashboardState(bookings, stats.sessions, now);
  const fallback = upcoming.find(
    (b) => b.status === "booked" && b.fallbackOfferedAt,
  );
  const when = (d: Date) =>
    format.dateTime(d, {
      timeZone: me.timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  return (
    <AppShell title={t("title")}>
      <div className={styles.dashboard}>
        <header className={styles.header}>
          <div className="page-title">
            <h1>
              {t(welcome ? "welcome" : "hello", {
                name: firstName(me.displayName),
              })}
            </h1>
            <p className="muted">{t("lead")}</p>
          </div>
          <div className={styles.actions}>
            <MatchNow className="button secondary" />
            <Link className="button" href="/book">
              {t("bookSession")}
            </Link>
          </div>
        </header>
        <SessionHero bookings={bookings} now={now} tz={me.timezone} />
        {fallback && (
          <FallbackCard bookingId={fallback.id} when={when(fallback.startAt)} />
        )}
        {state.showExplainer && <FirstRunGuide appName={getAppConfig().name} />}
        <section className="card stack" data-tour="stats">
          <div className="row-between">
            <h2>{t("thisWeek")}</h2>
            <Link className="link" href="/progress">
              {t("viewProgress")}
            </Link>
          </div>
          <div className={styles.week}>
            <div>
              <strong>
                {t("weeklySessions", {
                  done: prefs?.completedThisWeek ?? 0,
                  goal: prefs?.weeklyGoal ?? 3,
                })}
              </strong>
              <progress
                className={styles.progress}
                max={prefs?.weeklyGoal ?? 3}
                value={prefs?.completedThisWeek ?? 0}
                aria-label={t("thisWeek")}
              />
            </div>
            <div>
              <strong>{stats.dailyStreak}</strong>
              <p className="muted small">{t("streak")}</p>
            </div>
          </div>
        </section>
        <div className={styles.columns}>
          <section className="card stack">
            <h2>{t("upcoming")}</h2>
            {bookings.length ? (
              bookings.slice(0, 5).map((b) => (
                <Link
                  className={styles.bookingRow}
                  key={b.id}
                  href={`/book?start=${encodeURIComponent(b.startAt)}`}
                >
                  <Avatar
                    name={b.partner?.name ?? me.displayName}
                    src={b.partner?.avatar}
                  />
                  <div>
                    <strong>{when(new Date(b.startAt))}</strong>
                    <p className="muted small">
                      {c("minutes", { count: b.durationMin })} ·{" "}
                      {b.partner?.name ?? t("pairing")}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="muted">{t("noBookingLead")}</p>
            )}
          </section>
          <section className="card stack">
            <div className="row-between">
              <h2>{t("recentPartners")}</h2>
              <Link className="link" href="/people">
                {t("viewPeople")}
              </Link>
            </div>
            {recent.rows.length ? (
              <div className={styles.partners}>
                {recent.rows.map((p) => (
                  <Link key={p.id} href={`/u/${p.username}`}>
                    <Avatar size="lg" name={p.name} src={p.avatar} />
                    <span>{p.name}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">{t("partnersEmpty")}</p>
            )}
          </section>
        </div>
        <p className={styles.tip}>
          {prefs?.focusAreas[0]
            ? t("personalTip", {
                area: focus(`focusAreas.${prefs.focusAreas[0]}`),
              })
            : t("quietTip")}
        </p>
        <WelcomeFlow
          initialPhase={welcomePhase(me)}
          replay={tour === "replay"}
        />
      </div>
    </AppShell>
  );
}
