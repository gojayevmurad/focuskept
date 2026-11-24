// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { CircleCheck, Pencil } from "lucide-react";
import { communityFeed } from "@/src/lib/community/feed";
import { Avatar } from "@/src/components/avatar";
import { Link } from "@/src/i18n/navigation";
import { PostControls } from "./feed-controls";
import styles from "./community.module.css";

export async function Feed({
  userId,
  groupId,
  cursor,
  href = "/groups",
  timeZone,
}: {
  userId: string;
  groupId?: string;
  cursor?: string;
  href?: string;
  timeZone: string;
}) {
  const [t, format, { posts, next }] = await Promise.all([
    getTranslations("communityFeed"),
    getFormatter(),
    communityFeed(userId, groupId, cursor),
  ]);
  return (
    <section className={styles.feed} aria-label={t("feed")}>
      {posts.length ? (
        posts.map((post) => (
          <article className={styles.post} key={post.id} id={`post-${post.id}`}>
            <header className={styles.postHeader}>
              <Avatar name={post.name} src={post.avatarUrl} />
              <div className="grow">
                <Link href={`/u/${post.username}`}>
                  <strong>{post.name}</strong>
                </Link>
                <time
                  className="small muted"
                  dateTime={post.createdAt.toISOString()}
                >
                  {format.dateTime(post.createdAt, {
                    timeZone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </div>
              <span className="badge">
                {post.kind === "done" ? (
                  <CircleCheck size={14} aria-hidden="true" />
                ) : (
                  <Pencil size={14} aria-hidden="true" />
                )}
                {t(post.kind === "done" ? "done" : "working")}
              </span>
            </header>
            <p className={styles.postBody}>
              {post.automatic && post.body === "✓" ? t("autoWin") : post.body}
            </p>
            {post.sessionId && post.userId === userId && (
              <Link href={`/session/${post.sessionId}`} className="small">
                {t("viewSession")}
              </Link>
            )}
            <PostControls
              id={post.id}
              own={post.userId === userId}
              cheers={post.cheers}
              cheered={post.cheered}
            />
          </article>
        ))
      ) : (
        <div className={styles.post}>
          <h2>{t("emptyTitle")}</h2>
          <p className="muted">{t("emptyBody")}</p>
          <a className="button secondary" href="#composer">
            {t("firstPost")}
          </a>
        </div>
      )}
      {next && (
        <Link className="button secondary" href={`${href}?cursor=${next}`}>
          {t("older")}
        </Link>
      )}
      {cursor && (
        <Link className="button ghost" href={href}>
          {t("newest")}
        </Link>
      )}
    </section>
  );
}
