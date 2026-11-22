// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqList } from "@/src/components/marketing/faq";
import { Cta, SessionTimeline } from "@/src/components/marketing/cta";
import {
  absoluteUrl,
  localizedPath,
  requireMarketing,
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import { JsonLd } from "@/src/components/marketing/json-ld";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildGraph,
  buildHowToSchema,
} from "@/src/lib/seo/schema";
import styles from "@/src/components/marketing/marketing.module.css";
import type { Faq } from "@/src/lib/content/seo";

export async function generateMetadata({ params }: LocaleProps) {
  return translatedMetadata(params, "how", "/how-it-works");
}

export default async function How({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("how");
  const f = await getTranslations("faqPage");
  const groups = f.raw("groups") as { title: string; items: Faq[] }[];
  const stages = t.raw("stages") as { title: string; body: string }[];
  const howFaqs = groups[1].items.slice(0, 4);

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.pageHead}>
        <h1>{t("heading")}</h1>
        <p>{t("lead")}</p>
      </header>
      <SessionTimeline />
      <div className={styles.reading}>
        {stages.map((stage) => (
          <section key={stage.title}>
            <h2>{stage.title}</h2>
            <p>{stage.body}</p>
          </section>
        ))}
        <section>
          <h2>{t("matchingTitle")}</h2>
          <p>{t("matchingBody")}</p>
          <p>{t("fallbackBody")}</p>
        </section>
        <section>
          <h2>{t("etiquetteTitle")}</h2>
          <p>{t("etiquetteBody")}</p>
        </section>
        <section>
          <h2>{t("safetyTitle")}</h2>
          <p>{t("safetyBody")}</p>
        </section>
      </div>
      <section className={styles.section}>
        <h2>{t("faqTitle")}</h2>
        <FaqList items={howFaqs} structured={false} />
      </section>
      <Cta />
      <JsonLd
        data={buildGraph([
          buildBreadcrumbSchema([
            { name: "Home", url: absoluteUrl(localizedPath("/", locale)) },
            {
              name: t("heading"),
              url: absoluteUrl(localizedPath("/how-it-works", locale)),
            },
          ]),
          buildHowToSchema(t("heading"), t("lead"), stages),
          buildFaqSchema(howFaqs),
        ])}
      />
    </div>
  );
}
