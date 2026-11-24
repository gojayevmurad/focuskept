// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { discoverCommunities, myCommunities } from "@/src/lib/community";
import { postSessionOptions } from "@/src/lib/community/feed";
import { Link } from "@/src/i18n/navigation";
import { CreateGroupForm, JoinByCodeForm } from "./forms";
import { Composer } from "./feed-controls";
import { Feed } from "./feed";
import styles from "./community.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("communityFeed"))("title") };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { user, profile } = await requireAppUser();
  const [t, groups, discover, params, options] = await Promise.all([
    getTranslations("communityFeed"),
    myCommunities(user.id),
    discoverCommunities(user.id),
    searchParams,
    postSessionOptions(user.id),
  ]);
  return (
    <AppShell title={t("title")}>
      <div className={styles.page}>
        <header className="page-title">
          <h1>{t("title")}</h1>
          <p className="muted">{t("purpose")}</p>
        </header>
        <div className={styles.layout}>
          <div className={styles.main}>
            <div id="composer">
              <Composer
                automatic={profile.shareWinsAutomatically}
                sessions={options}
              />
            </div>
            <Feed
              userId={user.id}
              cursor={params.cursor}
              timeZone={profile.timezone}
            />
          </div>
          <aside className={styles.sidebar} aria-label={t("circles")}>
            <h2>{t("circles")}</h2>
            <nav className={styles.circles} aria-label={t("joinedCircles")}>
              <Link href="/groups" className={styles.chip} aria-current="page">
                {t("everyone")}
              </Link>
              {groups.map((g) => (
                <Link
                  key={g.id}
                  href={`/groups/${g.slug}`}
                  className={styles.chip}
                >
                  <strong>{g.name}</strong>
                  <span className="small muted">{g.members}</span>
                </Link>
              ))}
            </nav>
            <details className={styles.discovery} id="discover">
              <summary>{t("discover")}</summary>
              {discover.length ? (
                discover.map((g) => (
                  <Link
                    className={styles.chip}
                    href={`/groups/${g.slug}`}
                    key={g.id}
                  >
                    <span>
                      <strong>{g.name}</strong>
                      <span className="small muted">
                        {" "}
                        {t("memberCount", { count: g.members })}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <p className="small muted">{t("noCircles")}</p>
              )}
              <details>
                <summary>{t("createCircle")}</summary>
                <CreateGroupForm />
              </details>
              <details>
                <summary>{t("joinCode")}</summary>
                <JoinByCodeForm />
              </details>
            </details>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
