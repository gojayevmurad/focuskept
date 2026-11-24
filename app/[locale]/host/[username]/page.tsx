// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import { SiteHeader } from "@/src/components/site-header";
import { SiteFooter } from "@/src/components/site-footer";
import { Avatar } from "@/src/components/avatar";
import { LaneRope } from "@/src/components/lanes";
import { getProfile, getProfileByUsername } from "@/src/lib/profiles";
import { peopleHelped, hostedSessions } from "@/src/lib/hosts";
import { JoinHosted } from "@/app/[locale]/(app)/hosting/forms";
import { getHost } from "@/src/lib/hosts";
import { getSession } from "@/src/lib/auth/session";
import styles from "./host.module.css";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const person = await getProfileByUsername(username);
  const t = await getTranslations("hostPage");
  return person ? { title: t("pageTitle", { name: person.displayName }) } : {};
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
  const [upcoming, helped] = await Promise.all([
    hostedSessions(person.userId),
    peopleHelped(person.userId),
  ]);
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

        <p className="muted">{t("peopleHelped", { count: helped })}</p>
        <p className={styles.bio}>{t("hostPurpose")}</p>
        <LaneRope className={styles.rope} />

        <section className={styles.section}>
          <h2>{t("upcoming")}</h2>
          <p className="muted">{t("sessionHelp", { timezone: tz })}</p>
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
                        n: Math.max(0, s.capacity - 1 - s.attendees.length),
                      })}
                    </div>
                  </div>
                  <div className={styles.attendees}>
                    {s.attendees.slice(0, 6).map((p, i) => (
                      <span key={i} title={p.name}>
                        <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                      </span>
                    ))}
                  </div>
                  {viewer?.onboardedAt ? (
                    <JoinHosted
                      id={s.id}
                      full={s.attendees.length >= s.capacity - 1}
                    />
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
