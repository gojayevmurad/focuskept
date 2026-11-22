// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import { SiteHeader } from "@/src/components/site-header";
import { SiteFooter } from "@/src/components/site-footer";
import { Avatar } from "@/src/components/avatar";
import { LaneRope } from "@/src/components/lanes";
import { getProfile, getProfileByUsername } from "@/src/lib/profiles";
import { getHost } from "@/src/lib/hosts";
import { getSession } from "@/src/lib/auth/session";
import { db } from "@/src/lib/db";
import { focusSession, sessionParticipant } from "@/src/lib/db/schema";
import { Link } from "@/src/i18n/navigation";
import styles from "./host.module.css";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const person = await getProfileByUsername(username);
  return person ? { title: `Group sessions with ${person.displayName}` } : {};
}

export default async function Page({ params }: Props) {
  const { username } = await params;
  const person = await getProfileByUsername(username);
  if (!person || person.suspendedAt) notFound();
  const h = await getHost(person.userId);
  if (h?.status !== "approved") notFound();
  const t = await getTranslations("hostPage");
  const format = await getFormatter();
  const session = await getSession().catch(() => null);
  const viewer = session?.user.emailVerified
    ? await getProfile(session.user.id)
    : undefined;
  const tz = viewer?.timezone ?? person.timezone;
  const upcoming = await db()
    .select({
      id: focusSession.id,
      title: focusSession.title,
      startAt: focusSession.startAt,
      durationMin: focusSession.durationMin,
      capacity: focusSession.capacity,
      taken: sql<number>`(select count(*)::int from ${sessionParticipant} p where p.session_id = ${focusSession.id})`,
    })
    .from(focusSession)
    .where(
      and(
        eq(focusSession.hostId, person.userId),
        inArray(focusSession.status, ["scheduled", "live"]),
        gt(focusSession.startAt, new Date()),
      ),
    )
    .orderBy(focusSession.startAt)
    .limit(20);
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <div className={styles.hostHero}>
          <Avatar name={person.displayName} src={person.avatarUrl} size="lg" />
          <div className={styles.identity}>
            <span className="badge warm">{t("host")}</span>
            <h1 className={styles.displayName}>{person.displayName}</h1>
            <div className={styles.metaRow}>
              {h.rating ? (
                <>
                  <Star size={14} /> {h.rating.toFixed(1)} ({h.ratingsCount})
                  ·{" "}
                </>
              ) : null}
              {t("hosted", { n: h.sessionsHosted })}
            </div>
          </div>
        </div>

        {(person.bio || h.pitch) && (
          <p className={styles.bio}>{person.bio || h.pitch}</p>
        )}

        <LaneRope className={styles.rope} />

        <section className={styles.section}>
          <h2>{t("upcoming")}</h2>
          {upcoming.length ? (
            <div className={styles.sessionList}>
              {upcoming.map((s) => (
                <div key={s.id} className={styles.sessionCard}>
                  <div className={styles.sessionDetails}>
                    <strong className={styles.sessionTitle}>{s.title}</strong>
                    <div className={styles.sessionMeta}>
                      {format.dateTime(s.startAt, {
                        timeZone: tz,
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · {s.durationMin} min ·{" "}
                      {t("seatsLeft", {
                        n: Math.max(0, s.capacity - s.taken),
                      })}
                    </div>
                  </div>
                  {viewer?.onboardedAt ? (
                    <Link
                      className="button small"
                      href={`/book?start=${encodeURIComponent(s.startAt.toISOString())}`}
                    >
                      {t("takeSeat")}
                    </Link>
                  ) : (
                    <a
                      className="button small"
                      href={`/r/${person.referralCode}?next=${encodeURIComponent(`/sign-up?next=/host/${person.username}`)}`}
                    >
                      {t("signUp")}
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t("none")}</p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
