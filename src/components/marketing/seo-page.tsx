// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import {
  listSeoPages,
  type SeoPage as Content,
  type SeoTemplate,
} from "@/src/lib/content/seo";
import { absoluteUrl, localizedPath } from "@/src/lib/content/marketing";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildGraph,
} from "@/src/lib/seo/schema";
import { JsonLd } from "./json-ld";
import { Cta } from "./cta";
import { FaqList } from "./faq";
import styles from "./marketing.module.css";

export async function SeoPage({
  page,
  template,
  locale = "en",
}: {
  page: Content;
  template: SeoTemplate;
  locale?: string;
}) {
  const t = await getTranslations("seo");
  const related = listSeoPages(template, locale)
    .filter((other) => other.slug !== page.slug)
    .slice(0, 6);

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.pageHead}>
        <nav className={styles.breadcrumbs} aria-label={t("home")}>
          <Link href="/">{t("home")}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/${template}`}>{t(`templates.${template}`)}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{page.h1}</span>
        </nav>
        <h1>{page.h1}</h1>
        <p>{page.intro}</p>
      </header>
      <div className={styles.reading}>
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        ))}
        <section>
          <h2>{t("howTitle")}</h2>
          <p>{t("howBody")}</p>
        </section>
      </div>
      <section className={styles.section}>
        <h2>{t("faq")}</h2>
        <FaqList items={page.faq} structured={false} />
      </section>
      <Cta heading={page.cta.heading} body={page.cta.body} />
      <section className={styles.section}>
        <h2>{t("related")}</h2>
        <div className={styles.related}>
          {related.map((other) => (
            <Link href={`/${template}/${other.slug}`} key={other.slug}>
              {other.h1}
            </Link>
          ))}
        </div>
      </section>
      <JsonLd
        data={buildGraph([
          buildBreadcrumbSchema([
            { name: t("home"), url: absoluteUrl(localizedPath("/", locale)) },
            {
              name: t(`templates.${template}`),
              url: absoluteUrl(localizedPath(`/${template}`, locale)),
            },
            {
              name: page.h1,
              url: absoluteUrl(
                localizedPath(`/${template}/${page.slug}`, locale),
              ),
            },
          ]),
          buildFaqSchema(page.faq),
        ])}
      />
    </div>
  );
}

export async function SeoIndex({
  template,
  locale = "en",
}: {
  template: SeoTemplate;
  locale?: string;
}) {
  const t = await getTranslations("seo");
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.pageHead}>
        <h1>{t(`templates.${template}`)}</h1>
        <p>{t(`descriptions.${template}`)}</p>
      </header>
      <section className={styles.section}>
        <div className={styles.related}>
          {listSeoPages(template, locale).map((page) => (
            <Link href={`/${template}/${page.slug}`} key={page.slug}>
              <h2>{page.h1}</h2>
              <p className="muted">{page.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <Cta />
      <JsonLd
        data={buildGraph([
          buildBreadcrumbSchema([
            { name: t("home"), url: absoluteUrl(localizedPath("/", locale)) },
            {
              name: t(`templates.${template}`),
              url: absoluteUrl(localizedPath(`/${template}`, locale)),
            },
          ]),
        ])}
      />
    </div>
  );
}
