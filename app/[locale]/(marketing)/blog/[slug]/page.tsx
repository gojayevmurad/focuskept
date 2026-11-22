// SPDX-License-Identifier: AGPL-3.0-only
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { getAppConfig } from "@/src/config/app";
import { listBlogPosts, getBlogPost } from "@/src/lib/content/blog";
import {
  absoluteUrl,
  localizedPath,
  pageMetadata,
  requireMarketing,
  type SlugProps,
} from "@/src/lib/content/marketing";
import { JsonLd } from "@/src/components/marketing/json-ld";
import {
  buildBlogPostingSchema,
  buildBreadcrumbSchema,
  buildGraph,
} from "@/src/lib/seo/schema";
import { ArrowLeft } from "lucide-react";
import styles from "./article.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return listBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: SlugProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const post = getBlogPost(slug);
  if (!post) notFound();
  const metadata = pageMetadata(
    post.title,
    post.description,
    `/blog/${slug}`,
    "en",
    ["en"],
  );
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article" as const,
      publishedTime: post.date,
      authors: [post.author],
    },
  };
}

export default async function Article({ params }: SlugProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("blog");
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <div className={`container ${styles.page}`}>
      <article className={styles.article}>
        <header className={styles.articleHead}>
          <nav aria-label={t("back")}>
            <Link className={styles.backLink} href="/blog">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{t("back")}</span>
            </Link>
          </nav>
          <h1>{post.title}</h1>
          <p className={styles.lead}>{post.description}</p>
          <div className={styles.meta}>
            <span>{t("by", { author: post.author })}</span>
            <span aria-hidden="true" className={styles.metaDivider}>
              ·
            </span>
            <span>
              {t("published")}{" "}
              <time dateTime={post.date} className={styles.date}>
                {post.date}
              </time>
            </span>
          </div>
        </header>
        <div
          className={styles.prose}
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
        <footer className={styles.articleFoot}>
          <Link className={styles.backLink} href="/blog">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{t("back")}</span>
          </Link>
        </footer>
      </article>
      <JsonLd
        data={buildGraph([
          buildBreadcrumbSchema([
            { name: "Home", url: absoluteUrl(localizedPath("/", locale)) },
            {
              name: t("back"),
              url: absoluteUrl(localizedPath("/blog", locale)),
            },
            { name: post.title, url: absoluteUrl(`/blog/${slug}`) },
          ]),
          buildBlogPostingSchema(post, getAppConfig()),
        ])}
      />
    </div>
  );
}
