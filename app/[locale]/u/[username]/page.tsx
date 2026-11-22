// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, gt, inArray } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/src/components/site-header";
import { SiteFooter } from "@/src/components/site-footer";
import { Avatar } from "@/src/components/avatar";
import { LaneRope } from "@/src/components/lanes";
import { getProfileByUsername, getProfile } from "@/src/lib/profiles";
import { getSession } from "@/src/lib/auth/session";
import { db } from "@/src/lib/db";
import { booking, host } from "@/src/lib/db/schema";
import { userStats } from "@/src/lib/growth/stats";
import { addMinutes } from "@/src/lib/scheduling/slots";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { JoinSlot } from "./join-slot";
import styles from "./profile.module.css";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ start?: string; duration?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const person = await getProfileByUsername(username);
  if (!person || person.suspendedAt) return {};
  const app = getAppConfig();
  return {
    title: `Focus with ${person.displayName}`,
    description: `Book a ${app.name} session with ${person.displayName}.`,
    robots: { index: false },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { username } = await params;
  const { start, duration } = await searchParams;
  const person = await getProfileByUsername(username);
  if (!person || person.suspendedAt || !person.onboardedAt) notFound();
  const t = await getTranslations("publicProfile");
  const format = await getFormatter();
  const app = getAppConfig();
  const session = await getSession().catch(() => null);
  const viewer = session?.user.emailVerified
    ? await getProfile(session.user.id)
    : undefined;
  const tz = viewer?.timezone ?? person.timezone;
  const isSelf = viewer?.userId === person.userId;
  const [stats, open, hostRow] = await Promise.all([
    person.statsPublic ? userStats(person.userId, person.timezone) : null,
    db()
      .select({ startAt: booking.startAt, durationMin: booking.durationMin })
      .from(booking)
      .where(
        and(
          eq(booking.userId, person.userId),
          eq(booking.kind, "pair"),
          inArray(booking.status, ["booked"]),
          gt(booking.startAt, addMinutes(new Date(), 3)),
        ),
      )
      .orderBy(booking.startAt)
      .limit(8),
    db()
      .select()
      .from(host)
      .where(and(eq(host.userId, person.userId), eq(host.status, "approved"))),
  ]);
  // A specific invitation from an email link goes first.
  const invited =
    start && !Number.isNaN(new Date(start).getTime())
      ? { startAt: new Date(start), durationMin: Number(duration) || 50 }
      : null;
  const slots = invited
    ? [
        invited,
        ...open.filter(
          (o) => o.startAt.getTime() !== invited.startAt.getTime(),
        ),
      ]
    : open;
  const signUpHref = `/r/${person.referralCode}?next=${encodeURIComponent(`/sign-up?next=/u/${person.username}`)}`;

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <div className={styles.profileHero}>
          <Avatar name={person.displayName} src={person.avatarUrl} size="lg" />
          <div className={styles.identity}>
            <div className={styles.nameRow}>
              <h1 className={styles.displayName}>{person.displayName}</h1>
              <span className={styles.handle}>@{person.username}</span>
              {hostRow[0] && (
                <Link className="badge warm" href={`/host/${person.username}`}>
                  {t("host")}
                </Link>
              )}
            </div>
          </div>
        </div>

        {person.bio && <p className={styles.bio}>{person.bio}</p>}

        <LaneRope className={styles.rope} />

        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>{t("hours")}</span>
              <strong className={styles.statValue}>{stats.hours}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>{t("sessions")}</span>
              <strong className={styles.statValue}>{stats.sessions}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>{t("streak")}</span>
              <strong className={styles.statValue}>{stats.dailyStreak}</strong>
            </div>
          </div>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>
              {t("bookTitle", { name: person.displayName.split(" ")[0] })}
            </h2>
          </div>

          {isSelf ? (
            <p className="notice">{t("isYou")}</p>
          ) : slots.length ? (
            <div className={styles.scheduleList}>
              {slots.map((slot) => (
                <div
                  className={styles.slotCard}
                  key={slot.startAt.toISOString()}
                >
                  <div className={styles.slotDetails}>
                    <div className={styles.slotTimeRow}>
                      <span className={styles.slotTime}>
                        {format.dateTime(slot.startAt, {
                          timeZone: tz,
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className={styles.slotDate}>
                        {format.dateTime(slot.startAt, {
                          timeZone: tz,
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="badge">
                        {t("minutes", { n: slot.durationMin })}
                      </span>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    {viewer?.onboardedAt ? (
                      <JoinSlot
                        startAt={slot.startAt.toISOString()}
                        duration={slot.durationMin}
                        username={person.username}
                      />
                    ) : (
                      <a className="button small" href={signUpHref}>
                        {t("signUpToJoin")}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t("noOpen")}</p>
          )}

          {!isSelf &&
            (viewer?.onboardedAt ? (
              <Link
                className="button secondary"
                href={`/book?with=${person.username}`}
              >
                {t("otherTime")}
              </Link>
            ) : (
              <a className="button secondary" href={signUpHref}>
                {t("joinApp", { app: app.name })}
              </a>
            ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
