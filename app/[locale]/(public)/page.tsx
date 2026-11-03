import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  BellRing,
  Check,
  MessageSquareText,
  Sparkles,
  Timer,
} from "lucide-react";
import { ClientIntl } from "@/src/components/client-intl";
import { AnonymousFocus } from "@/src/features/focus/anonymous-focus";
import { techniqueLabels } from "@/src/features/techniques/content";
import { PLANNING_TECHNIQUES } from "@/src/features/techniques/slugs";
import { Link } from "@/src/i18n/navigation";
import { JsonLd } from "@/src/components/json-ld";
import { TechniqueGrid } from "@/src/features/techniques/technique-grid";
import { getTechniqueContent } from "@/src/features/techniques/content";
import { PRICES_USD } from "@/src/lib/billing/plans";
import {
  application,
  faq,
  graph,
  organization,
  website,
} from "@/src/lib/structured-data";
import { publicMetadata } from "@/src/lib/seo";
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
  return publicMetadata({
    locale,
    path: "/",
    title: t("defaultTitle"),
    description: t("defaultDescription"),
    absoluteTitle: true,
  });
}

const LOOP = [
  { key: "focus", icon: Timer },
  { key: "explain", icon: MessageSquareText },
  { key: "questions", icon: Sparkles },
  { key: "review", icon: BellRing },
] as const;

const FAQ = ["1", "2", "3", "4", "5"] as const;

export default async function Home({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("landing");
  const meta = await getTranslations("meta");
  const content = await getTechniqueContent(locale);
  const labels = await techniqueLabels(locale);
  const planningLabels = Object.fromEntries(
    PLANNING_TECHNIQUES.map((p) => [p, labels[p].name]),
  );
  const money = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          website(locale, meta("defaultDescription")),
          application(
            locale,
            meta("defaultDescription"),
            LOOP.map(({ key }) => t(`loop.${key}.text`)),
          ),
          faq(
            locale,
            "/",
            FAQ.map((n) => ({ q: t(`faq.${n}.q`), a: t(`faq.${n}.a`) })),
          ),
        )}
      />
      <h1 className="sr-only">{t("heroTitle")}</h1>
      <section className="timer-section" aria-label={t("heroTitle")}>
        <ClientIntl namespaces={["timer", "focus", "home"]}>
          <Suspense fallback={<div className="timer-skeleton skeleton" />}>
            <AnonymousFocus labels={labels} planningLabels={planningLabels} />
          </Suspense>
        </ClientIntl>
      </section>

      {/* Explainer for first-time visitors and search engines. */}
      <div className="landing-explainer" id="how">
        <section
          className="container"
          style={{ paddingBlock: 40 }}
          aria-labelledby="loop-title"
        >
          <div className="text-center mx-auto mb-8" style={{ maxWidth: 640 }}>
            <span className="eyebrow">{t("loop.eyebrow")}</span>
            <h2 id="loop-title" className="text-3xl">
              {t("loop.title")}
            </h2>
            <p className="muted mt-3">{t("loop.lead")}</p>
          </div>
          <ol
            className="grid-4"
            style={{ listStyle: "none", padding: 0, margin: 0 }}
          >
            {LOOP.map(({ key, icon: Icon }, i) => (
              <li key={key} className="card stack" style={{ gap: 8 }}>
                <span className="flex items-center gap-2">
                  <span className="badge badge-accent tabular">{i + 1}</span>
                  <Icon size={20} className="text-accent" aria-hidden="true" />
                </span>
                <h3 className="card-title">{t(`loop.${key}.title`)}</h3>
                <p className="small muted">{t(`loop.${key}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="container"
          style={{ paddingBlock: 40 }}
          aria-labelledby="demo-title"
        >
          <div className="grid-2" style={{ alignItems: "start" }}>
            <div className="stack">
              <span className="eyebrow">{t("demo.eyebrow")}</span>
              <h2 id="demo-title" className="text-3xl">
                {t("demo.title")}
              </h2>
              <p className="muted">{t("demo.lead")}</p>
              <div>
                <Link href="/learn" className="btn btn-primary">
                  {t("demo.cta")}
                </Link>
              </div>
            </div>
            <div className="card stack" aria-label={t("demo.label")}>
              <span className="badge badge-warning self-start">
                {t("demo.badge")}
              </span>
              <p className="label">{t("demo.topic")}</p>
              <blockquote
                className="small"
                style={{
                  borderInlineStart: "3px solid var(--border-strong)",
                  paddingInlineStart: 12,
                }}
              >
                {t("demo.explanation")}
              </blockquote>
              <div className="flex items-center justify-between gap-2">
                <span className="label">{t("demo.feedback")}</span>
                <span className="badge badge-accent tabular">
                  {t("demo.clarity")}
                </span>
              </div>
              <ul
                className="small"
                style={{ margin: 0, paddingInlineStart: 18 }}
              >
                <li>{t("demo.gap")}</li>
                <li>{t("demo.mistake")}</li>
              </ul>
              <p className="label">{t("demo.questionsLabel")}</p>
              <ol
                className="small stack"
                style={{ gap: 4, margin: 0, paddingInlineStart: 18 }}
              >
                <li>{t("demo.q1")}</li>
                <li>{t("demo.q2")}</li>
                <li>{t("demo.q3")}</li>
              </ol>
              <p className="hint">{t("demo.schedule")}</p>
            </div>
          </div>
        </section>

        <section
          className="container"
          style={{ paddingBlock: 40 }}
          aria-labelledby="techniques-title"
        >
          <div className="mb-6">
            <span className="eyebrow">{t("techniques.eyebrow")}</span>
            <h2 id="techniques-title" className="text-3xl">
              {t("techniques.title")}
            </h2>
            <p className="muted mt-2">{t("techniques.lead")}</p>
          </div>
          <TechniqueGrid content={content} />
        </section>

        <section
          className="container"
          style={{ paddingBlock: 40 }}
          aria-labelledby="pricing-title"
        >
          <div
            className="card card-accent grid-2"
            style={{ alignItems: "center" }}
          >
            <div className="stack" style={{ gap: 8 }}>
              <h2 id="pricing-title" className="text-2xl">
                {t("pricing.title")}
              </h2>
              <p className="muted">
                {t("pricing.lead", {
                  monthly: money(PRICES_USD.monthly),
                  yearly: money(PRICES_USD.yearly),
                })}
              </p>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {(["1", "2", "3"] as const).map((n) => (
                <p key={n} className="flex items-start gap-2 small">
                  <Check
                    size={16}
                    className="text-accent mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  {t(`pricing.points.${n}`)}
                </p>
              ))}
              <div>
                <Link href="/pricing" className="btn btn-secondary btn-sm">
                  {t("pricing.cta")}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          className="container-narrow"
          style={{ paddingBlock: 40 }}
          aria-labelledby="faq-title"
        >
          <h2 id="faq-title" className="text-2xl mb-4">
            {t("faq.title")}
          </h2>
          <div className="stack" style={{ gap: 8 }}>
            {FAQ.map((n) => (
              <details key={n} className="card card-sm">
                <summary className="font-medium" style={{ cursor: "pointer" }}>
                  {t(`faq.${n}.q`)}
                </summary>
                <p className="small muted mt-2">{t(`faq.${n}.a`)}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
