// SPDX-License-Identifier: AGPL-3.0-only
import { notFound } from "next/navigation";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { Avatar } from "@/src/components/avatar";
import { CopyLink } from "@/src/components/copy-link";
import { requireAppUser } from "@/src/lib/app-user";
import { getCommunity, members, membership } from "@/src/lib/community";
import { postSessionOptions } from "@/src/lib/community/feed";
import { db } from "@/src/lib/db";
import { communityMember, focusSession } from "@/src/lib/db/schema";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { JoinHosted } from "../../hosting/forms";
import { MemberActions } from "../forms";
import { Composer } from "../feed-controls";
import { Feed } from "../feed";
import styles from "../community.module.css";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { slug } = await params;
  const { user, profile } = await requireAppUser();
  const group = await getCommunity(slug);
  if (!group) notFound();
  const [me, list, t, format, query, options, upcoming] = await Promise.all([
    membership(group.id, user.id),
    members(group.id),
    getTranslations("groups"),
    getFormatter(),
    searchParams,
    postSessionOptions(user.id),
    db()
      .select({
        id: focusSession.id,
        title: focusSession.title,
        startAt: focusSession.startAt,
        durationMin: focusSession.durationMin,
      })
      .from(focusSession)
      .where(
        and(
          eq(focusSession.type, "group"),
          inArray(focusSession.status, ["scheduled", "live"]),
          gt(focusSession.startAt, new Date()),
          sql`exists (select 1 from ${communityMember} m where m.community_id = ${group.id} and m.user_id = ${focusSession.hostId})`,
        ),
      )
      .orderBy(focusSession.startAt)
      .limit(12),
  ]);
  const feed = await getTranslations("communityFeed");
  const licensed =
    group.licenseUntil &&
    group.licenseUntil > new Date() &&
    group.plusSeats > 0;
  return (
    <AppShell title={group.name}>
      <div className={styles.page}>
        <nav className={styles.breadcrumb} aria-label={feed("breadcrumb")}>
          <Link href="/groups">{feed("title")}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{group.name}</span>
        </nav>
        <header className="row-between">
          <div className="page-title">
            <h1>{group.name}</h1>
            <p className="muted">
              {group.description || feed("circlePurpose")}
            </p>
          </div>
          {!me ? (
            <MemberActions communityId={group.id} kind="join" />
          ) : me.role !== "owner" ? (
            <MemberActions communityId={group.id} kind="leave" />
          ) : (
            <span className="badge">{t("roles.owner")}</span>
          )}
        </header>
        {licensed && (
          <p className="notice ok">
            {t("licensed", {
              seats: group.plusSeats,
              date: format.dateTime(group.licenseUntil!, {
                dateStyle: "medium",
              }),
            })}
          </p>
        )}
        <div className={styles.layout}>
          <div className={styles.main}>
            {me && (
              <div id="composer">
                <Composer
                  automatic={profile.shareWinsAutomatically}
                  groupId={group.id}
                  sessions={options}
                />
              </div>
            )}
            {!me && <p className="notice">{feed("joinToPost")}</p>}
            <Feed
              userId={user.id}
              groupId={group.id}
              cursor={query.cursor}
              href={`/groups/${group.slug}`}
              timeZone={profile.timezone}
            />
          </div>
          <aside className={styles.sidebar}>
            <section className={styles.circleCard}>
              <h2>{t("members")}</h2>
              <p className="small muted">
                {t("memberCount", { count: list.length })}
              </p>
              <div className={styles.people}>
                {list.slice(0, 12).map((m) => (
                  <Avatar
                    key={m.userId}
                    name={m.name}
                    src={m.avatarUrl}
                    size="sm"
                  />
                ))}
              </div>
              <details>
                <summary>{feed("allMembers")}</summary>
                <div className="list">
                  {list.map((m) => (
                    <div key={m.userId} className="list-item">
                      <Link className="grow" href={`/u/${m.username}`}>
                        {m.name}
                      </Link>
                      {me && me.role !== "member" && m.role === "member" && (
                        <MemberActions
                          communityId={group.id}
                          userId={m.userId}
                          kind="remove"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </section>
            <section className={styles.circleCard}>
              <h2>{feed("circleSessions")}</h2>
              {upcoming.length ? (
                upcoming.map((s) => (
                  <div className={styles.session} key={s.id}>
                    <strong>{s.title}</strong>
                    <span className="small muted">
                      {format.dateTime(s.startAt, {
                        timeZone: profile.timezone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <JoinHosted id={s.id} />
                  </div>
                ))
              ) : (
                <p className="small muted">{feed("noCircleSessions")}</p>
              )}
            </section>
            {me && (
              <details className={styles.circleCard}>
                <summary>{t("invite")}</summary>
                <p className="small muted">{t("inviteLead")}</p>
                <CopyLink
                  value={`${getAppConfig().url.replace(/\/$/, "")}/groups/join/${group.joinCode}`}
                />
                {me.role !== "member" && (
                  <MemberActions communityId={group.id} kind="rotate" />
                )}
              </details>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
