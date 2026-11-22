// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { track } from "@/src/lib/analytics/client";
import type { Article, ArticleTopic } from "@/src/lib/support/articles";
import styles from "./help.module.css";

export function HelpClient({
  articles,
  topics,
}: {
  articles: Article[];
  topics: ArticleTopic[];
}) {
  const t = useTranslations("help");
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<ArticleTopic | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "yes" | "no">>({});

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (selectedTopic && article.topic !== selectedTopic) {
        return false;
      }
      if (!q) return true;
      return (
        article.title.toLowerCase().includes(q) ||
        article.summary.toLowerCase().includes(q) ||
        article.body.toLowerCase().includes(q) ||
        article.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [articles, query, selectedTopic]);

  const groupedArticles = useMemo(() => {
    const groups: Partial<Record<ArticleTopic, Article[]>> = {};
    for (const article of filteredArticles) {
      if (!groups[article.topic]) groups[article.topic] = [];
      groups[article.topic]!.push(article);
    }
    return groups;
  }, [filteredArticles]);

  const handleFeedback = (slug: string, helpful: "yes" | "no") => {
    setFeedback((prev) => ({ ...prev, [slug]: helpful }));
    try {
      track("help_viewed" as unknown as never, {
        article: slug,
        helpful: helpful === "yes",
      });
    } catch {
      // Analytics tracking is optional.
    }
  };

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.hero}>
        <h1>{t("heading")}</h1>
        <p>{t("lead")}</p>
        <div className={styles.searchWrap}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className={styles.clearSearch}
              onClick={() => setQuery("")}
              aria-label={t("clearSearch")}
            >
              ×
            </button>
          ) : null}
        </div>
      </header>

      <nav className={styles.topicsNav} aria-label={t("allTopics")}>
        <button
          type="button"
          className={`${styles.topicChip} ${selectedTopic === null ? styles.topicChipActive : ""}`}
          onClick={() => setSelectedTopic(null)}
        >
          {t("allTopics")}
        </button>
        {topics.map((topic) => (
          <button
            key={topic}
            type="button"
            className={`${styles.topicChip} ${selectedTopic === topic ? styles.topicChipActive : ""}`}
            onClick={() => setSelectedTopic(topic)}
          >
            {t(`topics.${topic}`)}
          </button>
        ))}
      </nav>

      <div className={styles.contentWrap}>
        {filteredArticles.length === 0 ? (
          <div className={styles.noResults}>
            <p>{t("noResults", { query })}</p>
          </div>
        ) : (
          topics.map((topic) => {
            const topicArticles = groupedArticles[topic];
            if (!topicArticles || topicArticles.length === 0) return null;
            return (
              <section key={topic} className={styles.topicGroup}>
                <h2 className={styles.topicHeading}>{t(`topics.${topic}`)}</h2>
                <div className={styles.articleList}>
                  {topicArticles.map((article) => {
                    const recorded = feedback[article.slug];
                    return (
                      <article
                        key={article.slug}
                        id={article.slug}
                        className={styles.articleCard}
                      >
                        <header className={styles.articleHeader}>
                          <h3>{article.title}</h3>
                          <a
                            href={`#${article.slug}`}
                            className={styles.anchorLink}
                            aria-label={`Link to ${article.title}`}
                          >
                            #
                          </a>
                        </header>
                        <p className={styles.summary}>{article.summary}</p>
                        <div className={styles.body}>{article.body}</div>
                        <footer className={styles.articleFooter}>
                          <div className={styles.helpfulSection}>
                            <span>{t("wasHelpful")}</span>
                            {recorded ? (
                              <span className={styles.helpfulRecorded}>
                                {t("helpfulRecorded")}
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className={styles.helpfulBtn}
                                  onClick={() =>
                                    handleFeedback(article.slug, "yes")
                                  }
                                >
                                  {t("helpfulYes")}
                                </button>
                                <button
                                  type="button"
                                  className={styles.helpfulBtn}
                                  onClick={() =>
                                    handleFeedback(article.slug, "no")
                                  }
                                >
                                  {t("helpfulNo")}
                                </button>
                              </>
                            )}
                          </div>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        <aside className={styles.contactBanner}>
          <h3>{t("needMoreHelp")}</h3>
          <p>{t("contactPrompt")}</p>
          <Link href="/contact" className="button">
            {t("contactButton")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
