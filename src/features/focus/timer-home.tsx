import { getLocale, getTranslations } from "next-intl/server";
import { ClientIntl } from "@/src/components/client-intl";
import { Link } from "@/src/i18n/navigation";
import { FocusApp } from "@/src/features/focus/focus-app";
import { formatMinutes } from "@/src/features/focus/format";
import { techniqueLabels } from "@/src/features/techniques/content";
import { isTechniqueSlug, registry } from "@/src/features/techniques/registry";
import {
  PLANNING_TECHNIQUES,
  type TimeTechnique,
} from "@/src/features/techniques/slugs";
import { getPreferences, today } from "@/src/features/preferences/server";
import { listTasks } from "@/src/features/tasks/server";
import {
  recommendationSessions,
  todayTrail,
  type TrailBlock,
} from "@/src/features/sessions/server";
import { countDue, dueCards } from "@/src/features/reviews/server";

/** Signed-in timer home: review strip, timer card, today's trail. */
export async function SignedInTimerHome({
  userId,
  technique,
  task,
  topic,
}: {
  userId: string;
  technique?: string;
  task?: string;
  topic?: string;
}) {
  const locale = await getLocale();
  const prefs = await getPreferences(userId);
  const day = today(prefs);
  const [labels, tasks, sessions, due, dueSample, trail] = await Promise.all([
    techniqueLabels(locale),
    listTasks(userId),
    recommendationSessions(userId),
    countDue(userId, day),
    dueCards(userId, day, 3),
    todayTrail(userId, prefs.timezone),
  ]);
  const initialTasks = tasks
    .map((t) => ({
      id: t.id,
      title: t.title,
      tags: t.tags,
      frog: t.isFrogOn === day,
      estimatedMinutes: t.estimatedMinutes,
    }))
    .sort((a, b) => Number(b.frog) - Number(a.frog));
  const initialTechnique =
    technique &&
    isTechniqueSlug(technique) &&
    registry[technique].group === "time"
      ? (technique as TimeTechnique)
      : undefined;
  return (
    <ClientIntl namespaces={["timer", "focus", "home"]}>
      <FocusApp
        signedIn
        labels={labels}
        planningLabels={Object.fromEntries(
          PLANNING_TECHNIQUES.map((p) => [p, labels[p].name]),
        )}
        initialTasks={initialTasks}
        recommendation={sessions}
        preferences={{
          soundSettings: prefs.soundSettings,
          techniqueSettings: prefs.techniqueSettings,
          customPresets: prefs.customPresets,
        }}
        initialTechnique={initialTechnique}
        defaultTechnique={prefs.defaultTimeTechnique as TimeTechnique}
        initialTaskId={task}
        initialSubject={topic?.slice(0, 200)}
        secondaryStart={due > 0}
        above={
          due > 0 ? (
            <ReviewStrip count={due} topics={dueSample.map((c) => c.topic)} />
          ) : undefined
        }
        below={<Trail blocks={trail} />}
      />
    </ClientIntl>
  );
}

async function ReviewStrip({
  count,
  topics,
}: {
  count: number;
  topics: string[];
}) {
  const t = await getTranslations("home");
  return (
    <section className="review-strip" aria-label={t("reviewStart")}>
      <div className="review-strip-text">
        <p className="review-strip-title">{t("reviewTitle", { count })}</p>
        {topics.length > 0 && (
          <p className="review-strip-topics" dir="auto">
            {topics.join(" · ")}
          </p>
        )}
      </div>
      <Link href="/app/review" className="btn review-strip-button">
        {t("reviewStart")}
      </Link>
    </section>
  );
}

/** Today's focus blocks (teal) with kept cards (amber dots), 08:00–22:00 or wider. */
export async function Trail({ blocks }: { blocks: TrailBlock[] }) {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const total = blocks.reduce((sum, b) => sum + b.focusedMinutes, 0);
  const cards = blocks.filter((b) => b.kept).length;
  const from = Math.min(8 * 60, ...blocks.map((b) => b.startMinute));
  const to = Math.max(
    22 * 60,
    ...blocks.map((b) => b.startMinute + b.focusedMinutes),
  );
  const span = to - from;
  const hour = (m: number) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2000, 0, 1, Math.floor(m / 60), m % 60)));
  return (
    <section className="trail focus-fade" aria-label={t("trailLabel")}>
      <span className="trail-summary">
        {t("trailLabel")} ·{" "}
        {total > 0
          ? t("trailSummary", {
              duration: formatMinutes(total, locale),
              cards,
            })
          : t("trailEmpty")}
      </span>
      <div className="trail-track" aria-hidden="true">
        {blocks.map((b, i) => {
          const start = ((b.startMinute - from) / span) * 100;
          const width = Math.max(0.8, (b.focusedMinutes / span) * 100);
          return (
            <span
              key={i}
              className="trail-block"
              style={{ insetInlineStart: `${start}%`, inlineSize: `${width}%` }}
            >
              {b.kept && <span className="trail-dot" />}
            </span>
          );
        })}
      </div>
      <span className="trail-range ltr-island">
        {hour(from)} – {hour(to)}
      </span>
    </section>
  );
}
