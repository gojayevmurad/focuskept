// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { listBlogPosts } from "@/src/lib/content/blog";
import {
  absoluteUrl,
  localizedPath,
  requireMarketing,
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import { JsonLd } from "@/src/components/marketing/json-ld";
import { buildBreadcrumbSchema, buildGraph } from "@/src/lib/seo/schema";
import { ArrowUpRight } from "lucide-react";
import styles from "./blog.module.css";

export async function generateMetadata({ params }: LocaleProps) {
  return translatedMetadata(params, "blog", "/blog");
}

export default async function Blog({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("blog");
  const posts = listBlogPosts();

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.pageHead}>
        <h1>{t("heading")}</h1>
        <p>{t("lead")}</p>
      </header>
      <ul className={styles.postList}>
        {posts.map((post, index) => {
          const isFirst = index === 0;
          return (
            <li
              key={post.slug}
              className={
                isFirst
                  ? `${styles.postRow} ${styles.featured}`
                  : styles.postRow
              }
            >
              <div className={styles.postMeta}>
                <time className={styles.postDate} dateTime={post.date}>
                  {post.date}
                </time>
              </div>
              <div className={styles.postBody}>
                <h2 className={styles.postTitle}>
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p className={styles.postDescription}>{post.description}</p>
                <div className={styles.postAction}>
                  <Link
                    className={styles.readLink}
                    href={`/blog/${post.slug}`}
                    aria-label={`${t("read")}: ${post.title}`}
                  >
                    <span>{t("read")}</span>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <JsonLd
        data={buildGraph([
          buildBreadcrumbSchema([
            { name: "Home", url: absoluteUrl(localizedPath("/", locale)) },
            {
              name: t("heading"),
              url: absoluteUrl(localizedPath("/blog", locale)),
            },
          ]),
        ])}
      />
    </div>
  );
}
