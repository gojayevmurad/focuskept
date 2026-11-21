// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import {
  listSeoPages,
  type SeoPage as Content,
  type SeoTemplate,
} from "@/src/lib/content/seo";
import { Cta } from "./cta";
import { FaqList } from "./faq";
export async function SeoPage({
  page,
  template,
}: {
  page: Content;
  template: SeoTemplate;
}) {
  const t = await getTranslations("seo");
  const related = listSeoPages(template)
    .filter((other) => other.slug !== page.slug)
    .slice(0, 6);
  return (
    <div className="container">
      <header className="page-head">
        <nav className="breadcrumbs" aria-label={t("home")}>
          <Link href="/">{t("home")}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/${template}`}>{t(`templates.${template}`)}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{page.h1}</span>
        </nav>
        <h1>{page.h1}</h1>
        <p className="lead">{page.intro}</p>
      </header>
      <div className="prose">
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        ))}
        <section className="card">
          <h2>{t("howTitle")}</h2>
          <p>{t("howBody")}</p>
        </section>
      </div>
      <section className="section stack">
        <h2>{t("faq")}</h2>
        <FaqList items={page.faq} structured />
      </section>
      <Cta heading={page.cta.heading} body={page.cta.body} />
      <section className="section stack">
        <h2>{t("related")}</h2>
        <div className="link-grid">
          {related.map((other) => (
            <Link href={`/${template}/${other.slug}`} key={other.slug}>
              {other.h1}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
export async function SeoIndex({ template }: { template: SeoTemplate }) {
  const t = await getTranslations("seo");
  return (
    <div className="container">
      <header className="page-head">
        <h1>{t(`templates.${template}`)}</h1>
        <p className="lead">{t(`descriptions.${template}`)}</p>
      </header>
      <section className="section">
        <div className="link-grid">
          {listSeoPages(template).map((page) => (
            <Link href={`/${template}/${page.slug}`} key={page.slug}>
              <h2>{page.h1}</h2>
              <p className="muted">{page.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <Cta />
    </div>
  );
}
