// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqList } from "@/src/components/marketing/faq";
import { Cta } from "@/src/components/marketing/cta";
import {
  requireMarketing,
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
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
  return (
    <div className="container">
      <header className="page-head">
        <h1>{t("heading")}</h1>
        <p className="lead">{t("lead")}</p>
      </header>
      <div className="prose">
        {(t.raw("stages") as { title: string; body: string }[]).map((stage) => (
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
      <section className="section stack">
        <h2>{t("faqTitle")}</h2>
        <FaqList items={groups[1].items.slice(0, 4)} structured />
      </section>
      <Cta />
    </div>
  );
}
