// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import styles from "@/app/[locale]/(app)/lanes.module.css";
import { eq } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { requireChallenges } from "@/src/lib/challenges/gate";
import { requireAppUser } from "@/src/lib/app-user";
import { listChallenges } from "@/src/lib/challenges";
import { db } from "@/src/lib/db";
import { challengeMember } from "@/src/lib/db/schema";
import { Link } from "@/src/i18n/navigation";
import { JoinChallenge } from "./join-button";

export const metadata: Metadata = { title: "Challenges" };

export default async function Page() {
  requireChallenges();
  const { user, profile } = await requireAppUser();
  const t = await getTranslations("challenges");
  const format = await getFormatter();
  const [all, mine] = await Promise.all([
    listChallenges(),
    db()
      .select({ id: challengeMember.challengeId })
      .from(challengeMember)
      .where(eq(challengeMember.userId, user.id)),
  ]);
  const joined = new Set(mine.map((m) => m.id));
  const now = new Date();
  const range = (a: Date, b: Date) =>
    format.dateTimeRange(a, b, {
      timeZone: profile.timezone,
      month: "short",
      day: "numeric",
    });
  const groups = [
    {
      key: "active",
      items: all.filter((c) => c.startsAt <= now && c.endsAt > now),
    },
    { key: "upcoming", items: all.filter((c) => c.startsAt > now) },
    { key: "past", items: all.filter((c) => c.endsAt <= now).slice(0, 10) },
  ] as const;
  return (
    <AppShell title={t("title")}>
      <div className={styles.page}>
        <div className="page-title">
          <h1>{t("title")}</h1>
          <p className="muted">{t("lead")}</p>
        </div>
        {all.length === 0 && <p className="muted">{t("none")}</p>}
        {groups.map(
          (g) =>
            g.items.length > 0 && (
              <section key={g.key} className="stack">
                <h2>{t(g.key)}</h2>
                <div className={`grid-2 ${styles.laneList}`}>
                  {g.items.map((c) => (
                    <article
                      key={c.id}
                      className={`card stack-sm ${styles.challenge}`}
                    >
                      <div className="row-between">
                        <span className="badge">
                          {range(c.startsAt, c.endsAt)}
                        </span>
                        <span className="small faint">
                          {t("members", { count: c.members })}
                        </span>
                      </div>
                      <h3>
                        <Link href={`/challenges/${c.slug}`}>{c.title}</Link>
                      </h3>
                      <p className="small muted">{c.description}</p>
                      <p className="small">
                        {t(`goal.${c.goalType}`, {
                          value:
                            c.goalType === "minutes"
                              ? Math.round(c.goalValue / 60)
                              : c.goalValue,
                        })}
                      </p>
                      <div className="row">
                        <JoinChallenge
                          id={c.id}
                          joined={joined.has(c.id)}
                          ended={c.endsAt <= now}
                        />
                        <Link
                          href={`/challenges/${c.slug}`}
                          className="button ghost small"
                        >
                          {t("leaderboard")}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ),
        )}
      </div>
    </AppShell>
  );
}
