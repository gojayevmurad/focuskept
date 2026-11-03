import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TechniqueGrid } from "@/src/features/techniques/technique-grid";
import { getTechniqueContent } from "@/src/features/techniques/content";
import { pageUrl, publicMetadata } from "@/src/lib/seo";
import { JsonLd } from "@/src/components/json-ld";
import { ALL_TECHNIQUES, publicSlug } from "@/src/features/techniques/slugs";
import { breadcrumbs, graph, webPage } from "@/src/lib/structured-data";
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
    path: "/techniques",
    title: t("techniquesTitle"),
    description: t("techniquesDescription"),
  });
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("techniquesPage");
  const meta = await getTranslations("meta");
  const content = await getTechniqueContent(locale);
  return (
    <div className="container" style={{ paddingBlock: "56px 24px" }}>
      <JsonLd
        data={graph(
          {
            ...webPage({
              locale,
              path: "/techniques",
              name: meta("techniquesTitle"),
              description: meta("techniquesDescription"),
              type: "CollectionPage",
            }),
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: ALL_TECHNIQUES.length,
              itemListElement: ALL_TECHNIQUES.map((slug, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: content[slug].name,
                url: pageUrl(locale, `/techniques/${publicSlug(slug)}`),
              })),
            },
          },
          breadcrumbs(locale, [[meta("techniquesTitle"), "/techniques"]]),
        )}
      />
      <div className="mb-10" style={{ maxWidth: 680 }}>
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="lead mt-3">{t("lead")}</p>
      </div>
      <TechniqueGrid content={content} headingLevel={2} />
    </div>
  );
}
