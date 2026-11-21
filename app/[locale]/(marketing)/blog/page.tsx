// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { listBlogPosts } from "@/src/lib/content/blog";
import {
  requireMarketing,
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
export async function generateMetadata({ params }: LocaleProps) {
  return translatedMetadata(params, "blog", "/blog");
}
export default async function Blog({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("blog");
  return (
    <div className="container">
      <header className="page-head">
        <h1>{t("heading")}</h1>
        <p className="lead">{t("lead")}</p>
      </header>
      <div className="section features">
        {listBlogPosts().map((post) => (
          <article className="card stack" key={post.slug}>
            <time className="small muted" dateTime={post.date}>
              {post.date}
            </time>
            <h2>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="muted">{post.description}</p>
            <Link
              className="link"
              href={`/blog/${post.slug}`}
              aria-label={`${t("read")}: ${post.title}`}
            >
              {t("read")}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
