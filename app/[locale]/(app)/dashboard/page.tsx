// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarPlus, ArrowRight, Video } from "lucide-react";
import { AppShell } from "@/src/components/app-shell";
import { getAppConfig } from "@/src/config/app";
import { requireAppUser } from "@/src/lib/app-user";
import { upcomingBookings } from "@/src/lib/bookings/service";
import { suggestedSlots } from "@/src/lib/bookings/availability";
import { userStats } from "@/src/lib/growth/stats";
import { db } from "@/src/lib/db";
import { focusSession, profile, sessionParticipant } from "@/src/lib/db/schema";
import { sessionLabel } from "@/src/lib/sessions/label";
import { roomWindow } from "@/src/lib/sessions/access";
import { firstName } from "@/src/lib/profiles/rules";
import { Link } from "@/src/i18n/navigation";
import { FallbackCard } from "./fallback-card";
import { PaceClock } from "@/src/components/lanes";
import { FirstRunGuide } from "./first-run-guide";
import { Tour } from "@/src/components/tour";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Home" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { user, profile: me } = await requireAppUser();
  const t = await getTranslations("dashboard");
  const c = await getTranslations("common");
  const labels = await getTranslations("sessionLabels");
  const format = await getFormatter();
  const tz = me.timezone;
  const { welcome } = await searchParams;
  const [upcoming, stats, suggestions] = await Promise.all([
    upcomingBookings(user.id),
    userStats(user.id, tz),
    suggestedSlots(user.id, 50, new Date(), 4, tz),
  ]);
  const sessionIds = upcoming
    .map((b) => b.sessionId)
    .filter((x): x is string => Boolean(x));
  const others = sessionIds.length
    ? await db()
        .select({
          sessionId: sessionParticipant.sessionId,
          userId: sessionParticipant.userId,
          name: profile.displayName,
          joinedAt: sessionParticipant.joinedAt,
          isFallbackRoom: focusSession.isFallbackRoom,
          type: focusSession.type,
          title: focusSession.title,
        })
        .from(sessionParticipant)
        .innerJoin(
          focusSession,
          eq(focusSession.id, sessionParticipant.sessionId),
        )
        .innerJoin(profile, eq(profile.userId, sessionParticipant.userId))
        .where(and(inArray(sessionParticipant.sessionId, sessionIds)))
    : [];
  const when = (d: Date) =>
    format.dateTime(d, {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  const now = new Date();
  const live = upcoming.find(
    (b) =>
      b.sessionId &&
      roomWindow(
        { startAt: b.startAt, durationMin: b.durationMin, status: "scheduled" },
        now,
      ) === "open",
  );
  const fallback = upcoming.find(
    (b) => b.status === "booked" && b.fallbackOfferedAt,
  );

  const laneBookings = live
    ? [live, ...upcoming.filter((b) => b.id !== live.id)]
    : upcoming;

  return (
    <AppShell title={t("title")}>
      <div className={styles.dashboard}>
        <header className={styles.title}>
          <h1>
            {welcome
              ? t("welcome", { name: firstName(me.displayName) })
              : t("hello", { name: firstName(me.displayName) })}
          </h1>
          <p>{me.goal ? t("goalReminder", { goal: me.goal }) : t("lead")}</p>
        </header>

        {fallback && (
          <FallbackCard bookingId={fallback.id} when={when(fallback.startAt)} />
        )}

        {stats.sessions === 0 && (
          <FirstRunGuide
            hasUpcoming={laneBookings.length > 0}
            firstBooking={
              laneBookings[0]
                ? {
                    id: laneBookings[0].id,
                    startAt: laneBookings[0].startAt.toISOString(),
                    durationMin: laneBookings[0].durationMin,
                    sessionId: laneBookings[0].sessionId,
                    status: laneBookings[0].status,
                  }
                : null
            }
            formattedTime={
              laneBookings[0] ? when(laneBookings[0].startAt) : undefined
            }
            suggestions={suggestions.map((s) => ({
              startAt: s.startAt.toISOString(),
              waiting: s.waiting,
              popular: s.popular,
            }))}
            tz={tz}
            appName={getAppConfig().name}
          />
        )}

        {(stats.sessions > 0 || laneBookings.length > 0) && (
          <section className={styles.upcoming} data-tour="upcoming">
            <div className={styles.sectionHeading}>
              <h2>{t("upcoming")}</h2>
              <Link href="/book" className={styles.buttonSecondary}>
                <CalendarPlus size={16} /> {t("book")}
              </Link>
            </div>
            {laneBookings.length > 0 ? (
              <div className={styles.bookingList}>
                {laneBookings.map((b, index) => {
                  const partners = others.filter(
                    (p) => p.sessionId === b.sessionId && p.userId !== user.id,
                  );
                  const session = others.find(
                    (p) => p.sessionId === b.sessionId,
                  );
                  const time = format.dateTime(b.startAt, {
                    timeZone: tz,
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const phaseMinutes = b.durationMin <= 25 ? 2 : 3;
                  return (
                    <article
                      key={b.id}
                      className={
                        index === 0 ? styles.laneCard : styles.bookingRow
                      }
                    >
                      {index === 0 && (
                        <PaceClock
                          phase="waiting"
                          progress={0}
                          focusFrom={phaseMinutes / b.durationMin}
                          wrapFrom={1 - phaseMinutes / b.durationMin}
                          size={80}
                        />
                      )}
                      <div className={styles.bookingInfo}>
                        <h3
                          className={
                            index === 0 ? styles.startTime : styles.rowTime
                          }
                        >
                          <time dateTime={b.startAt.toISOString()}>{time}</time>
                        </h3>
                        <p className={styles.meta}>
                          {format.dateTime(b.startAt, {
                            timeZone: tz,
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          · {c("minutes", { count: b.durationMin })}
                        </p>
                        <p className={styles.partner}>
                          {b.status === "matched"
                            ? session &&
                              (session.type === "group" ||
                                session.isFallbackRoom)
                              ? sessionLabel(
                                  session,
                                  partners.map((p) => ({
                                    name: p.name,
                                    joined: Boolean(p.joinedAt),
                                  })),
                                  labels,
                                )
                              : t("with", { name: partners[0]?.name ?? "" })
                            : t("pairing")}
                        </p>
                        {b.id === live?.id && (
                          <div className={styles.live}>
                            <span className={styles.liveBadge}>
                              <Video size={14} /> {t("liveBadge")}
                            </span>
                            <p>{t("liveTitle", { time })}</p>
                          </div>
                        )}
                      </div>
                      <div className={styles.actions}>
                        {b.sessionId && (
                          <Link
                            href={`/session/${b.sessionId}`}
                            className={styles.button}
                          >
                            {b.id === live?.id ? t("joinNow") : t("open")}{" "}
                            <ArrowRight size={16} />
                          </Link>
                        )}
                        <Link
                          href={`/book?start=${encodeURIComponent(b.startAt.toISOString())}`}
                          className={styles.buttonSecondary}
                        >
                          {t("manage")}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.empty}>
                <p>{t("empty")}</p>
                <div className={styles.suggestions} data-tour="suggestions">
                  {suggestions.map((s) => (
                    <Link
                      key={s.startAt.toISOString()}
                      className={styles.suggestion}
                      href={`/book?start=${encodeURIComponent(s.startAt.toISOString())}`}
                    >
                      {when(s.startAt)}
                      {s.waiting > 0 && (
                        <span className={styles.waiting}>
                          {t("waiting", { count: s.waiting })}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <dl className={styles.stats} data-tour="stats">
          <div className={styles.stat}>
            <dt>{t("streak")}</dt>
            <dd>
              <strong>{format.number(stats.dailyStreak)}</strong>
              <span>{t("streakHint", { weeks: stats.weeklyStreak })}</span>
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>{t("hours")}</dt>
            <dd>
              <strong>{format.number(stats.hours)}</strong>
              <span>{t("hoursHint", { month: stats.monthHours })}</span>
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>{t("sessions")}</dt>
            <dd>
              <strong>{format.number(stats.sessions)}</strong>
              <span>
                {stats.sessions === 0
                  ? t("firstRunEmptyStats")
                  : stats.completionRate === null
                    ? t("noOutcomes")
                    : t("doneRate", { rate: stats.completionRate })}
              </span>
            </dd>
          </div>
        </dl>

        <Tour autoStart={Boolean(welcome)} isFirstRun={stats.sessions === 0} />
      </div>
    </AppShell>
  );
}
