import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { PageHeader } from "@/src/components/page-header";
import { ClientIntl } from "@/src/components/client-intl";
import { BarChart } from "@/src/components/charts/bar-chart";
import { UpgradeCard } from "@/src/features/limits/upgrade-card";
import { requireSession } from "@/src/lib/auth/session";
import { hasEntitlement } from "@/src/lib/billing/entitlements";
import {
  getPreferences,
  today as todayOf,
} from "@/src/features/preferences/server";
import { streakDays } from "@/src/features/sessions/server";
import { computeStreak } from "@/src/features/sessions/streak";
import { bestStreak } from "@/src/features/stats/streaks";
import {
  dailyFocus,
  focusByHour,
  focusByTag,
  focusByGroup,
  focusSummary,
  lifetimeTotals,
  retentionByStep,
  retentionByTopic,
  retentionSince,
  techniqueRanking,
} from "@/src/features/stats/server";
import { techniqueLabels } from "@/src/features/techniques/content";
import { formatMinutes } from "@/src/features/focus/format";
import { addDays } from "@/src/lib/dates";
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
  return { title: t("stats") };
}

const RANGES = [7, 30, 90] as const;

export default async function Page({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<{ range?: string }> }) {
  const locale = await resolveLocale(params);
  const { user } = await requireSession("/app/stats");
  const prefs = await getPreferences(user.id);
  const today = todayOf(prefs);
  const requested = (await searchParams).range;
  const days = RANGES.find((r) => String(r) === requested) ?? 30;
  const range = {
    timezone: prefs.timezone,
    from: addDays(today, -(days - 1)),
    to: today,
  };
  const pro = await hasEntitlement(user.id);
  const [
    summary,
    daily,
    ranking,
    week,
    streak,
    totals,
    r30,
    r90,
    topics,
    labels,
    groups,
  ] = await Promise.all([
    focusSummary(user.id, range),
    dailyFocus(
      user.id,
      days <= 30 ? range : { ...range, from: addDays(today, -29) },
    ),
    techniqueRanking(user.id, range),
    techniqueRanking(user.id, {
      timezone: prefs.timezone,
      from: addDays(today, -6),
      to: today,
    }),
    streakDays(user.id, prefs.timezone),
    lifetimeTotals(user.id),
    retentionSince(user.id, 30),
    retentionSince(user.id, 90),
    retentionByTopic(user.id, 90),
    techniqueLabels(locale),
    focusByGroup(user.id, range),
  ]);
  // The full Lab is computed only for Pro users (server-side gating).
  const lab = pro
    ? await Promise.all([
        techniqueRanking(user.id, null),
        focusByTag(user.id),
        focusByHour(user.id, prefs.timezone, null),
        retentionByStep(user.id, null),
      ])
    : null;
  const t = await getTranslations("stats");
  const lang = await getLocale();
  const nf = new Intl.NumberFormat(lang);
  const nf1 = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const pct = (v: number | null) =>
    v === null ? "–" : `${nf.format(Math.round(v * 100))}%`;
  const name = (slug: string) =>
    labels[slug as keyof typeof labels]?.name ?? slug;
  const weekday = new Intl.DateTimeFormat(lang, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  const short = new Intl.DateTimeFormat(lang, {
    day: "numeric",
    timeZone: "UTC",
  });
  const topWeek = week.find((w) => w.rated > 0);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          <nav className="segmented" aria-label={t("rangeLabel")}>
            {RANGES.map((r) => (
              <Link
                key={r}
                href={{ pathname: "/app/stats", query: { range: r } }}
                aria-current={r === days ? "page" : undefined}
              >
                {t("range", { days: r })}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid-4">
        {[
          [t("focused"), formatMinutes(summary.seconds / 60, lang)],
          [t("sessions"), nf.format(summary.sessions)],
          [
            t("avgRating"),
            summary.avg_rating ? nf1.format(summary.avg_rating) : "–",
          ],
          [t("streak"), t("days", { count: computeStreak(streak, today) })],
          [t("bestStreak"), t("days", { count: bestStreak(streak) })],
          [t("retention30"), pct(r30.rate)],
          [t("retention90"), pct(r90.rate)],
          [t("cardsTotal"), nf.format(totals.cards)],
        ].map(([label, value]) => (
          <div key={label} className="card card-sm stat">
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>

      <section className="card">
        <BarChart
          caption={t("dailyChart")}
          tableLabel={t("showTable")}
          columns={[t("day"), t("minutes")]}
          bars={daily.map((d, i) => ({
            key: d.day,
            label:
              daily.length <= 7
                ? weekday.format(new Date(`${d.day}T12:00:00Z`))
                : (daily.length - 1 - i) % 5 === 0
                  ? short.format(new Date(`${d.day}T12:00:00Z`))
                  : "",
            value: d.minutes,
            display: formatMinutes(d.minutes, lang),
          }))}
        />
      </section>

      <div className="grid-2">
        <section className="card stack">
          <h2 className="card-title">{t("techniques")}</h2>
          {ranking.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t("technique")}</th>
                  <th scope="col">{t("sessions")}</th>
                  <th scope="col">{t("avgRating")}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => (
                  <tr key={row.technique}>
                    <th scope="row">{name(row.technique)}</th>
                    <td className="tabular">{nf.format(row.sessions)}</td>
                    <td className="tabular">
                      {row.avg_rating ? nf1.format(row.avg_rating) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="small muted">{t("noSessions")}</p>
          )}
        </section>
        <section className="card stack">
          <h2 className="card-title">{t("topics")}</h2>
          {topics.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t("topic")}</th>
                  <th scope="col">{t("reviews")}</th>
                  <th scope="col">{t("retention")}</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((row) => (
                  <tr key={row.topic}>
                    <th scope="row" dir="auto">
                      {row.topic}
                    </th>
                    <td className="tabular">{nf.format(row.reviews)}</td>
                    <td className="tabular">
                      {pct(row.reviews ? row.passed / row.reviews : null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="small muted">{t("noReviews")}</p>
          )}
        </section>
      </div>

      <div className="grid-2">
        {(["project", "subject"] as const).map((kind) => {
          const rows = groups.filter((g) => g.kind === kind);
          const max = Math.max(1, ...rows.map((r) => r.seconds));
          return (
            <section key={kind} className="card stack">
              <h2 className="card-title">
                {kind === "project" ? t("byProject") : t("bySubject")}
              </h2>
              {rows.length ? (
                <ul className="group-bars">
                  {rows.map((row) => (
                    <li key={row.name}>
                      <span className="group-bars-name" dir="auto">
                        <span
                          className={
                            kind === "subject"
                              ? "project-dot is-round"
                              : "project-dot"
                          }
                          style={{ background: row.color }}
                          aria-hidden="true"
                        />
                        {row.name}
                      </span>
                      <span className="group-bars-value tabular">
                        {formatMinutes(row.seconds / 60, lang)}
                      </span>
                      <span className="group-bars-track" aria-hidden="true">
                        <span
                          style={{
                            inlineSize: `${(row.seconds / max) * 100}%`,
                            background: row.color,
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">
                  {kind === "project" ? t("noProjects") : t("noSubjects")}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <section className="stack" aria-labelledby="lab-title">
        <h2 id="lab-title" className="text-xl flex items-center gap-2">
          <FlaskConical size={20} className="text-accent" aria-hidden="true" />
          {t("lab.title")}
        </h2>
        <p className="muted small">{t("lab.lead")}</p>
        <div className="card card-sm">
          {topWeek ? (
            <p>
              {t("lab.weekTop", {
                technique: name(topWeek.technique),
                rating: topWeek.avg_rating ?? 0,
                sessions: topWeek.sessions,
              })}
            </p>
          ) : (
            <p className="small muted">{t("lab.needData")}</p>
          )}
        </div>
        {lab ? (
          <>
            <div className="grid-2">
              <section className="card stack">
                <h3 className="card-title">{t("lab.allTime")}</h3>
                {lab[0].length ? (
                  <ol
                    className="small"
                    style={{ margin: 0, paddingInlineStart: 20 }}
                  >
                    {lab[0].slice(0, 6).map((row) => (
                      <li key={row.technique}>
                        {t("lab.rankRow", {
                          technique: name(row.technique),
                          rating: row.avg_rating ?? 0,
                          sessions: row.sessions,
                        })}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="small muted">{t("lab.needData")}</p>
                )}
              </section>
              <section className="card stack">
                <h3 className="card-title">{t("lab.byTag")}</h3>
                {lab[1].length ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">{t("lab.tag")}</th>
                        <th scope="col">{t("lab.best")}</th>
                        <th scope="col">{t("avgRating")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...new Map(
                          lab[1].map((row) => [row.tag, row]),
                        ).values(),
                      ]
                        .slice(0, 10)
                        .map((row) => (
                          <tr key={row.tag}>
                            <th scope="row">#{row.tag}</th>
                            <td>{name(row.technique)}</td>
                            <td className="tabular">
                              {row.avg_rating
                                ? nf1.format(row.avg_rating)
                                : "–"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="small muted">{t("lab.noTags")}</p>
                )}
              </section>
            </div>
            <div className="grid-2">
              <section className="card">
                <BarChart
                  caption={t("lab.byHour")}
                  tableLabel={t("showTable")}
                  columns={[t("lab.hour"), t("avgRating")]}
                  bars={Array.from({ length: 24 }, (_, hour) => {
                    const row = lab[2].find((r) => r.hour === hour);
                    return {
                      key: String(hour),
                      label: hour % 6 === 0 ? nf.format(hour) : "",
                      value: row?.avg_rating ?? 0,
                      display: row?.avg_rating
                        ? `${nf1.format(row.avg_rating)} · ${formatMinutes(row.minutes, lang)}`
                        : "–",
                    };
                  })}
                />
              </section>
              <section className="card">
                <BarChart
                  caption={t("lab.curve")}
                  tableLabel={t("showTable")}
                  columns={[t("lab.step"), t("retention")]}
                  bars={lab[3].map((row) => ({
                    key: String(row.step),
                    label:
                      row.step >= prefs.reviewSteps.length
                        ? t("lab.graduated")
                        : t("lab.dayN", { day: prefs.reviewSteps[row.step] }),
                    value: row.reviews ? row.passed / row.reviews : 0,
                    display: `${pct(row.reviews ? row.passed / row.reviews : null)} (${nf.format(row.reviews)})`,
                  }))}
                />
              </section>
            </div>
          </>
        ) : (
          <ClientIntl namespaces={["limits"]}>
            <UpgradeCard reason="lab" />
          </ClientIntl>
        )}
      </section>
    </div>
  );
}
