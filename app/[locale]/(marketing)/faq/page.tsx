// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqList } from "@/src/components/marketing/faq";
import { JsonLd } from "@/src/components/marketing/json-ld";
import { Cta } from "@/src/components/marketing/cta";
import {
  requireMarketing,
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import type { Faq } from "@/src/lib/content/seo";
export async function generateMetadata({ params }: LocaleProps) {
  return translatedMetadata(params, "faqPage", "/faq");
}
export default async function FaqPage({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("faqPage");
  const groups = t.raw("groups") as { title: string; items: Faq[] }[];
  return (
    <div className="container">
      <header className="page-head">
        <h1>{t("heading")}</h1>
        <p className="lead">{t("lead")}</p>
      </header>
      {groups.map((group) => (
        <section className="section stack" key={group.title}>
          <h2>{group.title}</h2>
          <FaqList items={group.items} />
        </section>
      ))}
      <Cta />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: groups
            .flatMap((group) => group.items)
            .map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
        }}
      />
    </div>
  );
}
