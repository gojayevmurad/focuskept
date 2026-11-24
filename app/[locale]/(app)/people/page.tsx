// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { Avatar } from "@/src/components/avatar";
import { requireAppUser } from "@/src/lib/app-user";
import { getPlan } from "@/src/lib/billing/plan";
import { Link } from "@/src/i18n/navigation";
import { FavoriteButton, UnblockButton, BlockButton } from "./people-actions";
import { peoplePage, peopleParameters } from "./queries";
import styles from "./people.module.css";
export const metadata: Metadata = { title: "People" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const { user, profile: me } = await requireAppUser();
  const params = peopleParameters(await searchParams);
  const [t, format, plan, result] = await Promise.all([
    getTranslations("people"),
    getFormatter(),
    getPlan(user.id),
    peoplePage(user.id, params),
  ]);
  const href = (page: number) =>
    `/people?${new URLSearchParams({ tab: params.tab, q: params.q, page: String(page) })}`;
  return (
    <AppShell title={t("title")}>
      <div className={styles.page}>
        <header className="page-title">
          <h1>{t("title")}</h1>
          <p className="muted">{t("lead")}</p>
        </header>
        <nav className={styles.tabs} aria-label={t("title")}>
          {["recent", "favorites", "blocked"].map((tab) => (
            <Link
              key={tab}
              href={`/people?tab=${tab}`}
              aria-current={params.tab === tab ? "page" : undefined}
            >
              {t(tab)}
            </Link>
          ))}
        </nav>
        <form className={styles.search}>
          <input type="hidden" name="tab" value={params.tab} />
          <label className="field">
            {t("search")}
            <input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder={t("searchPlaceholder")}
              maxLength={60}
            />
          </label>
          <button className="button secondary">{t("search")}</button>
        </form>
        {params.tab === "favorites" && plan.plan !== "plus" && (
          <p className="notice">{t("favoritesPlus")}</p>
        )}
        {result.rows.length ? (
          <div className={styles.grid}>
            {result.rows.map((person) => (
              <article className={`card ${styles.person}`} key={person.id}>
                <div className="row">
                  <Avatar name={person.name} src={person.avatar} size="lg" />
                  <div className={styles.identity}>
                    <h2>{person.name}</h2>
                    <Link className="link" href={`/u/${person.username}`}>
                      @{person.username}
                    </Link>
                  </div>
                </div>
                <p className="muted small">{person.bio || t("noBio")}</p>
                <p className="small">
                  {t("together", { count: person.count })}
                  {person.at && (
                    <span className="muted">
                      {" "}
                      ·{" "}
                      {t("lastSession", {
                        date: format.dateTime(person.at, {
                          timeZone: me.timezone,
                          dateStyle: "medium",
                        }),
                      })}
                    </span>
                  )}
                </p>
                <div className={styles.actions}>
                  {params.tab === "blocked" ? (
                    <UnblockButton userId={person.id} />
                  ) : (
                    <>
                      <FavoriteButton
                        userId={person.id}
                        active={person.favorite}
                        disabled={plan.plan !== "plus"}
                      />
                      <Link
                        className="button secondary small"
                        href={`/book?with=${encodeURIComponent(person.username)}`}
                      >
                        {t("bookWith")}
                      </Link>
                      <BlockButton userId={person.id} />
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="card stack">
            <h2>
              {t(
                params.q
                  ? "noResults"
                  : params.tab === "recent"
                    ? "noRecent"
                    : params.tab === "favorites"
                      ? "noFavorites"
                      : "noBlocked",
              )}
            </h2>
            <p className="muted">
              {t(
                params.q
                  ? "searchHint"
                  : params.tab === "blocked"
                    ? "blockedHint"
                    : "emptyHint",
              )}
            </p>
            {params.tab === "recent" && !params.q && (
              <Link href="/book" className="button">
                {t("bookSession")}
              </Link>
            )}
          </section>
        )}
        <nav className="row" aria-label={t("pagination")}>
          {params.page > 1 && (
            <Link className="button secondary" href={href(params.page - 1)}>
              {t("previous")}
            </Link>
          )}
          {result.more && (
            <Link className="button secondary" href={href(params.page + 1)}>
              {t("next")}
            </Link>
          )}
        </nav>
      </div>
    </AppShell>
  );
}
