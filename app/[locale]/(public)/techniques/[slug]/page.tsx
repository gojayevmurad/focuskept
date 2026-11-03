import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { ClientIntl } from "@/src/components/client-intl";
import { JsonLd } from "@/src/components/json-ld";
import { getTechniqueContent } from "@/src/features/techniques/content";
import { registry } from "@/src/features/techniques/registry";
import {
  ALL_TECHNIQUES,
  publicSlug,
  slugFromPublic,
} from "@/src/features/techniques/slugs";
import { techniqueIcons } from "@/src/features/techniques/icons";
import {
  TryGuide,
  TryPlanning,
  TryTimer,
} from "@/src/features/techniques/try-it";
import englishContent from "@/content/techniques/en.json";
import { pageUrl, publicMetadata } from "@/src/lib/seo";
import { breadcrumbs, ORG_ID, SITE_ID } from "@/src/lib/structured-data";
import { isLocale, type Locale } from "@/src/i18n/config";
import { resolveLocale } from "@/src/i18n/server";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return ALL_TECHNIQUES.map((slug) => ({ slug: publicSlug(slug) }));
}

const englishName = (slug: string) =>
  (englishContent as Record<string, { name: string }>)[slug]?.name;

/** Descriptive names keep the English term in parentheses for search (glossary rule). */
function displayName(locale: Locale, slug: string, localized: string) {
  const english = englishName(slug);
  return locale !== "en" && english && english !== localized
    ? `${localized} (${english})`
    : localized;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug: segment } = await params;
  const locale = isLocale(raw) ? raw : "en";
  const slug = slugFromPublic(segment);
  if (!slug) return {};
  const c = (await getTechniqueContent(locale))[slug];
  return publicMetadata({
    locale,
    path: `/techniques/${segment}`,
    title: c.seoTitle,
    description: c.seoDescription,
    absoluteTitle: true,
    type: "article",
    ownImage: true,
  });
}

export default async function Page({ params }: Props) {
  const locale = await resolveLocale(params);
  const { slug: segment } = await params;
  const slug = slugFromPublic(segment);
  if (!slug) notFound();
  const content = await getTechniqueContent(locale);
  const c = content[slug];
  const entry = registry[slug];
  const t = await getTranslations("techniquesPage");
  const meta = await getTranslations("meta");
  const Icon = techniqueIcons[entry.icon];
  const title = displayName(locale, slug, c.name);
  const url = pageUrl(locale, `/techniques/${segment}`);
  return (
    <article className="container-narrow" style={{ paddingBlock: "40px 24px" }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              "@id": `${url}#article`,
              headline: c.seoTitle,
              description: c.seoDescription,
              inLanguage: locale,
              url,
              mainEntityOfPage: url,
              isPartOf: { "@id": SITE_ID() },
              author: { "@id": ORG_ID() },
              publisher: { "@id": ORG_ID() },
            },
            breadcrumbs(locale, [
              [meta("techniquesTitle"), "/techniques"],
              [title, `/techniques/${segment}`],
            ]),
            {
              "@type": "HowTo",
              name: title,
              description: c.summary,
              inLanguage: locale,
              step: c.steps.map((text, i) => ({
                "@type": "HowToStep",
                position: i + 1,
                text,
              })),
            },
            {
              "@type": "FAQPage",
              mainEntity: c.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }}
      />
      <Link
        href="/techniques"
        className="link small inline-flex items-center gap-1"
      >
        <ArrowLeft size={15} className="rtl-flip" aria-hidden="true" />
        {t("all")}
      </Link>
      <header className="stack mt-6" style={{ gap: 10 }}>
        <span className="eyebrow flex items-center gap-2">
          <Icon size={16} aria-hidden="true" />
          {t(`groups.${entry.group}`)}
        </span>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <p className="lead">{c.tagline}</p>
        <p>{c.summary}</p>
      </header>

      <section className="mt-10 stack" aria-labelledby="try">
        <h2 id="try" className="text-2xl">
          {t("tryNow")}
        </h2>
        <ClientIntl namespaces={["timer", "tryIt", "tasks"]}>
          {entry.group === "time" ? (
            <TryTimer technique={entry.slug} />
          ) : entry.group === "learning" ? (
            <TryGuide name={c.name} steps={c.steps} />
          ) : (
            <TryPlanning technique={entry.slug} />
          )}
        </ClientIntl>
      </section>

      <div className="prose mt-10">
        <h2>{t("howItWorks")}</h2>
        {c.howItWorks.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <h2>{t("steps")}</h2>
        <ol>
          {c.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <h2>{t("bestFor")}</h2>
        <ul>
          {c.bestFor.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <h2>{t("whenNotToUse")}</h2>
        <ul>
          {c.whenNotToUse.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <h2>{t("faq")}</h2>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {c.faq.map((f, i) => (
          <details key={i} className="card card-sm">
            <summary className="font-medium" style={{ cursor: "pointer" }}>
              {f.q}
            </summary>
            <p className="small muted mt-2">{f.a}</p>
          </details>
        ))}
      </div>

      <section className="mt-10" aria-labelledby="related">
        <h2 id="related" className="text-xl mb-3">
          {t("related")}
        </h2>
        <ul
          className="choice-grid"
          style={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          {entry.related.map((related) => (
            <li key={related} className="flex">
              <Link
                href={`/techniques/${publicSlug(related)}`}
                className="choice w-full"
              >
                <span className="choice-title">{content[related].name}</span>
                <span className="choice-text">{content[related].tagline}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {slug === "pomodoro" && (
        <p className="small muted mt-10">{t("trademarkNotice")}</p>
      )}
    </article>
  );
}
