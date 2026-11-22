// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqList } from "@/src/components/marketing/faq";
import { JsonLd } from "@/src/components/marketing/json-ld";
import { Cta } from "@/src/components/marketing/cta";
import {
  absoluteUrl,
  localizedPath,
  requireMarketing,
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildGraph,
} from "@/src/lib/seo/schema";
import styles from "@/src/components/marketing/marketing.module.css";
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
  const allFaqs = groups.flatMap((group) => group.items);

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.pageHead}>
        <h1>{t("heading")}</h1>
        <p>{t("lead")}</p>
      </header>
      {groups.map((group) => (
        <section className={styles.section} key={group.title}>
          <h2>{group.title}</h2>
          <FaqList items={group.items} />
        </section>
      ))}
      <Cta />
      <JsonLd
        data={buildGraph([
          buildBreadcrumbSchema([
            { name: "Home", url: absoluteUrl(localizedPath("/", locale)) },
            {
              name: t("heading"),
              url: absoluteUrl(localizedPath("/faq", locale)),
            },
          ]),
          buildFaqSchema(allFaqs),
        ])}
      />
    </div>
  );
}
