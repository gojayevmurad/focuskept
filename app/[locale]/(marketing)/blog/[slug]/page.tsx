// SPDX-License-Identifier: AGPL-3.0-only
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { getAppConfig } from "@/src/config/app";
import { listBlogPosts, getBlogPost } from "@/src/lib/content/blog";
import {
  absoluteUrl,
  pageMetadata,
  requireMarketing,
  type SlugProps,
} from "@/src/lib/content/marketing";
import { JsonLd } from "@/src/components/marketing/json-ld";
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
  const metadata = pageMetadata(post.title, post.description, `/blog/${slug}`);
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
    <div className="container">
      <article>
        <header className="page-head">
          <Link className="link" href="/blog">
            {t("back")}
          </Link>
          <h1>{post.title}</h1>
          <p className="lead">{post.description}</p>
          <p className="small muted">
            {t("by", { author: post.author })} · {t("published")}{" "}
            <time dateTime={post.date}>{post.date}</time>
          </p>
        </header>
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </article>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          author: { "@type": "Organization", name: post.author },
          publisher: { "@type": "Organization", name: getAppConfig().name },
          mainEntityOfPage: absoluteUrl(`/blog/${slug}`),
        }}
      />
    </div>
  );
}
