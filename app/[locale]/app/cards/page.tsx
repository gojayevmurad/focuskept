import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Brain, Plus, Search } from "lucide-react";
import { PageHeader } from "@/src/components/page-header";
import { Link } from "@/src/i18n/navigation";
import { cardBoxes, listCards, listTopics } from "@/src/features/cards/server";
import { cardAllowance } from "@/src/features/limits/server";
import { getPreferences, today } from "@/src/features/preferences/server";
import { dueLabel } from "@/src/features/cards/due-label";
import { requireSession } from "@/src/lib/auth/session";
import {
  metadataLocale,
  resolveLocale,
  type LocaleParams,
} from "@/src/i18n/server";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("cards") };
}

type Query = {
  q?: string;
  status?: string;
  topic?: string;
  sort?: string;
  cursor?: string;
};

export default async function Page({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<Query> }) {
  await resolveLocale(params);
  const { user } = await requireSession("/app/cards");
  const query = await searchParams;
  const status = query.status === "archived" ? "archived" : "active";
  const sort = query.sort === "new" ? "new" : "due";
  const q = query.q?.slice(0, 200) || undefined;
  const topic = query.topic?.slice(0, 200) || undefined;
  const [prefs, { cards, nextCursor }, topics, allowance] = await Promise.all([
    getPreferences(user.id),
    listCards(user.id, {
      q,
      status,
      topic,
      sort,
      cursor: query.cursor?.slice(0, 200),
    }),
    listTopics(user.id),
    cardAllowance(user.id),
  ]);
  const t = await getTranslations("cards");
  const home = await getTranslations("home");
  const locale = await getLocale();
  const day = today(prefs);
  const boxes = await cardBoxes(user.id, day, prefs.reviewSteps);
  const nf = new Intl.NumberFormat(locale);
  const groups = new Map<string, typeof cards>();
  for (const card of cards)
    groups.set(card.topic, [...(groups.get(card.topic) ?? []), card]);
  const hasFilters = Boolean(q || topic || status === "archived");
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/learn/new"
              className={boxes[0] > 0 ? "btn btn-secondary" : "btn btn-primary"}
            >
              <Plus size={16} aria-hidden="true" />
              {t("newSession")}
            </Link>
            {boxes[0] > 0 && (
              <Link href="/app/review" className="btn btn-amber">
                {home("reviewStart")} · {nf.format(boxes[0])}
              </Link>
            )}
          </div>
        }
      />
      <section className="boxes" aria-label={t("boxes.label")}>
        <ol className="boxes-row">
          {boxes.map((count, i) => (
            <li key={i} className={i === 0 ? "box is-today" : "box"}>
              <span className="box-label">
                {i === 0
                  ? t("boxes.today")
                  : i <= prefs.reviewSteps.length
                    ? t("boxes.days", { days: prefs.reviewSteps[i - 1] })
                    : t("graduated")}
              </span>
              <span className="box-count tabular">{nf.format(count)}</span>
            </li>
          ))}
        </ol>
        <p className="hint">{t("boxes.hint")}</p>
      </section>
      {allowance.limit !== null && (
        <p className="hint mb-3">
          {t("allowance", { used: allowance.used, limit: allowance.limit })}
        </p>
      )}
      <form
        className="card card-sm mb-5 flex flex-wrap items-end gap-3"
        role="search"
      >
        <label className="field" style={{ flex: "1 1 220px" }}>
          <span className="label tiny">{t("searchLabel")}</span>
          <input
            className="input"
            name="q"
            defaultValue={q}
            maxLength={200}
            placeholder={t("searchPlaceholder")}
          />
        </label>
        <label className="field">
          <span className="label tiny">{t("topicLabel")}</span>
          <select
            className="select select-sm"
            name="topic"
            defaultValue={topic ?? ""}
          >
            <option value="">{t("allTopics")}</option>
            {topics.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label tiny">{t("statusLabel")}</span>
          <select
            className="select select-sm"
            name="status"
            defaultValue={status}
          >
            <option value="active">{t("active")}</option>
            <option value="archived">{t("archived")}</option>
          </select>
        </label>
        <label className="field">
          <span className="label tiny">{t("sortLabel")}</span>
          <select className="select select-sm" name="sort" defaultValue={sort}>
            <option value="due">{t("sortDue")}</option>
            <option value="new">{t("sortNew")}</option>
          </select>
        </label>
        <button className="btn btn-secondary btn-sm">
          <Search size={15} aria-hidden="true" />
          {t("search")}
        </button>
      </form>
      {cards.length === 0 ? (
        <div className="card empty">
          <Brain size={32} aria-hidden="true" />
          <h2>{hasFilters ? t("noResults") : t("emptyTitle")}</h2>
          {!hasFilters && <p className="small">{t("emptyText")}</p>}
          {!hasFilters && (
            <Link href="/app/learn/new" className="btn btn-primary">
              {t("newSession")}
            </Link>
          )}
        </div>
      ) : (
        <div className="stack">
          {[...groups.entries()].map(([name, items]) => (
            <section key={name} className="card stack" style={{ gap: 6 }}>
              <h2 className="card-title" dir="auto">
                {name}
              </h2>
              <ul className="list">
                {items.map((card) => (
                  <li key={card.id}>
                    <Link
                      href={`/app/cards/${card.id}`}
                      className="flex flex-1 flex-wrap items-center gap-2 min-w-0"
                    >
                      <span className="badge">
                        {card.currentStep >= prefs.reviewSteps.length
                          ? t("graduated")
                          : t("box", { n: card.currentStep + 1 })}
                      </span>
                      <span className="small muted">
                        {t("questionsCount", { count: card.questions })}
                      </span>
                      <span
                        className={
                          card.dueOn <= day && card.status === "active"
                            ? "badge badge-warning ms-auto"
                            : "badge ms-auto"
                        }
                      >
                        {dueLabel(card.dueOn, day, locale, (key, values) =>
                          t(key, values as never),
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {nextCursor && (
            <div>
              <Link
                className="btn btn-secondary"
                href={{
                  pathname: "/app/cards",
                  query: { ...query, cursor: nextCursor },
                }}
              >
                {t("more")}
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
