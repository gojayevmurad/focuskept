import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Repeat } from "lucide-react";
import { ClientIntl } from "@/src/components/client-intl";
import { Link } from "@/src/i18n/navigation";
import { getCard } from "@/src/features/cards/server";
import { CardEditor } from "@/src/features/cards/card-detail";
import { dueLabel } from "@/src/features/cards/due-label";
import { getPreferences, today } from "@/src/features/preferences/server";
import { techniqueLabels } from "@/src/features/techniques/content";
import { requireSession } from "@/src/lib/auth/session";
import { idSchema } from "@/src/lib/api";
import { metadataLocale, resolveLocale } from "@/src/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("card") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  const { user } = await requireSession(`/app/cards/${id}`);
  if (!idSchema.safeParse(id).success) notFound();
  const data = await getCard(user.id, id);
  if (!data) notFound();
  const { card, questions, reviews } = data;
  const [prefs, labels, t, tc] = await Promise.all([
    getPreferences(user.id),
    techniqueLabels(locale),
    getTranslations("cards.detail"),
    getTranslations("cards"),
  ]);
  const lang = await getLocale();
  const day = today(prefs);
  const date = (value: Date) =>
    new Intl.DateTimeFormat(lang, {
      dateStyle: "medium",
      timeZone: prefs.timezone,
    }).format(value);
  const dayDate = (value: string) =>
    new Intl.DateTimeFormat(lang, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${value}T12:00:00Z`));
  return (
    <div className="stack" style={{ gap: 20 }}>
      <Link
        href="/app/cards"
        className="link small inline-flex items-center gap-1"
      >
        <ArrowLeft size={15} className="rtl-flip" aria-hidden="true" />
        {t("back")}
      </Link>
      <div className="page-header" style={{ marginBlockEnd: 0 }}>
        <div>
          <h1 dir="auto">{card.topic}</h1>
          <p>
            {card.status === "archived"
              ? t("archivedNote")
              : dueLabel(card.dueOn, day, lang, (key, values) =>
                  tc(key, values as never),
                )}
          </p>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <Link
            href={{ pathname: "/app/review", query: { card: card.id } }}
            className="btn btn-primary"
          >
            <Repeat size={16} aria-hidden="true" />
            {t("reviewNow")}
          </Link>
          <span className="hint">{t("reviewNowHint")}</span>
        </div>
      </div>
      <dl className="grid-4 card card-sm">
        <div className="stat">
          <dt className="stat-label">{t("nextReview")}</dt>
          <dd className="small">{dayDate(card.dueOn)}</dd>
        </div>
        <div className="stat">
          <dt className="stat-label">{t("reviews")}</dt>
          <dd className="small tabular">
            {new Intl.NumberFormat(lang).format(card.reviewCount)}
          </dd>
        </div>
        <div className="stat">
          <dt className="stat-label">{t("method")}</dt>
          <dd className="small">
            {labels[card.learningMethod as keyof typeof labels]?.name ??
              card.learningMethod}
          </dd>
        </div>
        <div className="stat">
          <dt className="stat-label">{t("created")}</dt>
          <dd className="small">{date(card.createdAt)}</dd>
        </div>
      </dl>
      {card.sourceUrl && (
        <p className="small">
          {t("source")}:{" "}
          <a
            className="link break-all"
            href={card.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            dir="ltr"
          >
            {card.sourceUrl}
          </a>
        </p>
      )}
      {card.analysis && (
        <section className="card card-sm stack" style={{ gap: 6 }}>
          <h2 className="card-title">{t("analysis")}</h2>
          <p className="small tabular">
            {(await getTranslations("learn.explain"))("clarity", {
              score: card.analysis.clarityScore,
            })}
          </p>
          {[...card.analysis.gaps, ...card.analysis.mistakes].length > 0 && (
            <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
              {[...card.analysis.gaps, ...card.analysis.mistakes].map(
                (item, i) => (
                  <li key={i} dir="auto">
                    {item}
                  </li>
                ),
              )}
            </ul>
          )}
        </section>
      )}
      <ClientIntl namespaces={["cards"]}>
        <CardEditor
          id={card.id}
          topic={card.topic}
          explanation={card.explanation}
          status={card.status}
          questions={questions.map((q) => ({
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            answer: q.answer,
            explanation: q.explanation ?? "",
            source: q.source,
          }))}
        />
      </ClientIntl>
      <section className="card stack">
        <h2 className="card-title">{t("history")}</h2>
        {reviews.length ? (
          <ul className="list">
            {reviews.map((r) => (
              <li key={r.id} className="small">
                <span className="flex-1">{date(r.completedAt)}</span>
                <span className="tabular">
                  {t("score", { score: r.scorePct })}
                </span>
                <span
                  className={
                    r.wasEarly
                      ? "badge"
                      : r.passed
                        ? "badge badge-success"
                        : "badge badge-warning"
                  }
                >
                  {r.wasEarly
                    ? t("early")
                    : r.passed
                      ? t("passed")
                      : t("missed")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">{t("noHistory")}</p>
        )}
      </section>
    </div>
  );
}
