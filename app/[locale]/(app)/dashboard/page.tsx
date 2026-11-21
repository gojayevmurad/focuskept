// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  CalendarPlus,
  Flame,
  Clock,
  CheckCircle2,
  ArrowRight,
  Video,
} from "lucide-react";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { upcomingBookings } from "@/src/lib/bookings/service";
import { suggestedSlots } from "@/src/lib/bookings/availability";
import { userStats } from "@/src/lib/growth/stats";
import { db } from "@/src/lib/db";
import { profile, sessionParticipant } from "@/src/lib/db/schema";
import { roomWindow } from "@/src/lib/sessions/access";
import { firstName } from "@/src/lib/profiles/rules";
import { Link } from "@/src/i18n/navigation";
import { FallbackCard } from "./fallback-card";

export const metadata: Metadata = { title: "Home" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { user, profile: me } = await requireAppUser();
  const t = await getTranslations("dashboard");
  const c = await getTranslations("common");
  const format = await getFormatter();
  const tz = me.timezone;
  const { welcome } = await searchParams;
  const [upcoming, stats, suggestions] = await Promise.all([
    upcomingBookings(user.id),
    userStats(user.id, tz),
    suggestedSlots(user.id, 50, new Date(), 4),
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
        })
        .from(sessionParticipant)
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

  return (
    <AppShell title={t("title")}>
      <div className="page-title">
        <h1>
          {welcome
            ? t("welcome", { name: firstName(me.displayName) })
            : t("hello", { name: firstName(me.displayName) })}
        </h1>
        <p className="muted">
          {me.goal ? t("goalReminder", { goal: me.goal }) : t("lead")}
        </p>
      </div>

      {live && (
        <section
          className="card row-between"
          style={{ borderColor: "var(--accent)" }}
        >
          <div className="stack-sm">
            <span className="badge accent">
              <Video size={12} /> {t("liveBadge")}
            </span>
            <h2>
              {t("liveTitle", {
                time: format.dateTime(live.startAt, {
                  timeZone: tz,
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })}
            </h2>
          </div>
          <Link href={`/session/${live.sessionId}`} className="button">
            {t("joinNow")} <ArrowRight size={16} />
          </Link>
        </section>
      )}
      {fallback && (
        <FallbackCard bookingId={fallback.id} when={when(fallback.startAt)} />
      )}

      <div className="grid-3">
        <div className="card stat">
          <span className="muted small row">
            <Flame size={15} /> {t("streak")}
          </span>
          <strong>{stats.dailyStreak}</strong>
          <span className="small faint">
            {t("streakHint", { weeks: stats.weeklyStreak })}
          </span>
        </div>
        <div className="card stat">
          <span className="muted small row">
            <Clock size={15} /> {t("hours")}
          </span>
          <strong>{stats.hours}</strong>
          <span className="small faint">
            {t("hoursHint", { month: stats.monthHours })}
          </span>
        </div>
        <div className="card stat">
          <span className="muted small row">
            <CheckCircle2 size={15} /> {t("sessions")}
          </span>
          <strong>{stats.sessions}</strong>
          <span className="small faint">
            {stats.completionRate === null
              ? t("noOutcomes")
              : t("doneRate", { rate: stats.completionRate })}
          </span>
        </div>
      </div>

      <section className="card stack">
        <div className="row-between">
          <h2>{t("upcoming")}</h2>
          <Link href="/book" className="button small">
            <CalendarPlus size={15} /> {t("book")}
          </Link>
        </div>
        {upcoming.length ? (
          <div className="list">
            {upcoming.map((b) => {
              const partner = others.find(
                (o) => o.sessionId === b.sessionId && o.userId !== user.id,
              );
              return (
                <div key={b.id} className="list-item">
                  <div className="grow stack-sm" style={{ gap: 2 }}>
                    <strong>{when(b.startAt)}</strong>
                    <span className="small muted">
                      {c("minutes", { count: b.durationMin })} ·{" "}
                      {b.status === "matched"
                        ? b.kind === "group"
                          ? t("group")
                          : t("with", { name: partner?.name ?? "" })
                        : t("pairing")}
                    </span>
                  </div>
                  {b.sessionId ? (
                    <Link
                      href={`/session/${b.sessionId}`}
                      className="button secondary small"
                    >
                      {t("open")}
                    </Link>
                  ) : (
                    <Link
                      href={`/book?start=${encodeURIComponent(b.startAt.toISOString())}`}
                      className="button ghost small"
                    >
                      {t("manage")}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stack-sm">
            <p className="muted">{t("empty")}</p>
            {suggestions.length > 0 && (
              <div className="chips">
                {suggestions.map((s) => (
                  <Link
                    key={s.startAt.toISOString()}
                    className="chip"
                    href={`/book?start=${encodeURIComponent(s.startAt.toISOString())}`}
                  >
                    {when(s.startAt)}
                    {s.waiting > 0 && (
                      <span className="badge accent">
                        {t("waiting", { count: s.waiting })}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
