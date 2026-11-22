// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import styles from "@/app/[locale]/(app)/lanes.module.css";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getFormatter, getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { Avatar } from "@/src/components/avatar";
import { requireAppUser } from "@/src/lib/app-user";
import { db } from "@/src/lib/db";
import {
  block,
  favorite,
  focusSession,
  profile,
  sessionParticipant,
} from "@/src/lib/db/schema";
import { getPlan } from "@/src/lib/billing/plan";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { FavoriteButton, UnblockButton } from "./people-actions";

export const metadata: Metadata = { title: "People" };

export default async function Page() {
  const { user, profile: me } = await requireAppUser();
  const t = await getTranslations("people");
  const format = await getFormatter();
  const app = getAppConfig();
  const plus = (await getPlan(user.id)).plan === "plus";
  const mine = alias(sessionParticipant, "mine");
  const [favorites, recent, blocked] = await Promise.all([
    db()
      .select({
        id: profile.userId,
        name: profile.displayName,
        username: profile.username,
        avatar: profile.avatarUrl,
      })
      .from(favorite)
      .innerJoin(profile, eq(profile.userId, favorite.partnerId))
      .where(eq(favorite.userId, user.id)),
    db()
      .select({
        id: sessionParticipant.userId,
        name: profile.displayName,
        username: profile.username,
        avatar: profile.avatarUrl,
        at: focusSession.startAt,
      })
      .from(mine)
      .innerJoin(focusSession, eq(focusSession.id, mine.sessionId))
      .innerJoin(
        sessionParticipant,
        and(
          eq(sessionParticipant.sessionId, mine.sessionId),
          ne(sessionParticipant.userId, user.id),
        ),
      )
      .innerJoin(profile, eq(profile.userId, sessionParticipant.userId))
      .where(
        and(
          eq(mine.userId, user.id),
          eq(focusSession.status, "ended"),
          inArray(focusSession.type, ["pair", "group"]),
        ),
      )
      .orderBy(desc(focusSession.startAt))
      .limit(40),
    db()
      .select({ id: block.blockedId, name: profile.displayName })
      .from(block)
      .innerJoin(profile, eq(profile.userId, block.blockedId))
      .where(eq(block.blockerId, user.id)),
  ]);
  const favIds = new Set(favorites.map((f) => f.id));
  const seen = new Set<string>();
  const recentUnique = recent.filter(
    (r) =>
      !seen.has(r.id) && seen.add(r.id) && !blocked.some((b) => b.id === r.id),
  );
  const link = `${app.url.replace(/^https?:\/\//, "")}/u/${me.username}`;

  return (
    <AppShell title={t("title")}>
      <div className={styles.page}>
        <div className="page-title">
          <h1>{t("title")}</h1>
          <p className="muted">{t("lead")}</p>
        </div>
        <section className="card stack-sm">
          <h2>{t("yourLink")}</h2>
          <p className="muted small">{t("yourLinkLead")}</p>
          <code className="mono small">{link}</code>
        </section>
        <section className="card stack">
          <h2>{t("favorites")}</h2>
          {!plus && (
            <p className="notice warn">
              {t("favoritesPlus")}{" "}
              {app.billingEnabled && (
                <Link href="/pricing" className="link">
                  {t("seePlus")}
                </Link>
              )}
            </p>
          )}
          {favorites.length ? (
            <div className="list">
              {favorites.map((f) => (
                <div className="list-item" key={f.id}>
                  <Avatar name={f.name} src={f.avatar} />
                  <div className="grow">
                    <strong>{f.name}</strong>
                    <div className="small faint">@{f.username}</div>
                  </div>
                  <Link
                    href={`/u/${f.username}`}
                    className="button secondary small"
                  >
                    {t("bookWith")}
                  </Link>
                  <FavoriteButton userId={f.id} active />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">{t("noFavorites")}</p>
          )}
        </section>
        <section className="card stack">
          <h2>{t("recent")}</h2>
          {recentUnique.length ? (
            <div className="list">
              {recentUnique.map((r) => (
                <div className="list-item" key={r.id}>
                  <Avatar name={r.name} src={r.avatar} />
                  <div className="grow">
                    <strong>{r.name}</strong>
                    <div className="small faint">
                      {format.dateTime(r.at, {
                        timeZone: me.timezone,
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <FavoriteButton
                    userId={r.id}
                    active={favIds.has(r.id)}
                    disabled={!plus}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">{t("noRecent")}</p>
          )}
        </section>
        {blocked.length > 0 && (
          <section className="card stack">
            <h2>{t("blocked")}</h2>
            <div className="list">
              {blocked.map((b) => (
                <div className="list-item" key={b.id}>
                  <span className="grow">{b.name}</span>
                  <UnblockButton userId={b.id} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
