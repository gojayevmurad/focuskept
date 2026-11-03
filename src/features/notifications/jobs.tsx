import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { authSecret, getEnv } from "@/src/config/env";
import { logger } from "@/src/lib/logger";
import { deliver, emailTranslator } from "@/src/lib/email/send";
import {
  addDays,
  isoWeekKey,
  localDate,
  startOfWeek,
  withinWindow,
  zonedParts,
} from "@/src/lib/dates";
import { defaultLocale, isLocale, type Locale } from "@/src/i18n/config";
import type { WorkHours } from "@/src/lib/db/json-types";
import { hasEntitlement } from "@/src/lib/billing/entitlements";
import { getTechniqueContent } from "@/src/features/techniques/content";
import { computeStreak } from "@/src/features/sessions/streak";
import { streakDays } from "@/src/features/sessions/server";
import {
  focusSummary,
  learningSummary,
  previousMonth,
  techniqueRanking,
  topicsCreated,
} from "@/src/features/stats/server";
import { ReviewDigestEmail } from "@/src/emails/review-digest";
import { WeeklyReportEmail } from "@/src/emails/weekly-report";
import { sendOnce } from "./log";
import { pushConfigured, sendPush } from "./push";
import { signUnsubscribe } from "./tokens";
import { weeklySuggestion } from "./suggestion";

const BATCH = 500;
const DIGEST_TOPICS = 5;

type Candidate = {
  user_id: string;
  email: string;
  timezone: string;
  locale: string;
  email_reviews: boolean;
  email_weekly: boolean;
  work_hours: WorkHours;
  weekly_focus_goal_minutes: number;
};

const localeOf = (value: string): Locale =>
  isLocale(value) ? value : defaultLocale;
const appUrl = () => getEnv().APP_URL.replace(/\/$/, "");
function unsubscribeUrl(userId: string, category: "reviews" | "weekly") {
  return `${appUrl()}/api/unsubscribe?token=${signUnsubscribe(authSecret(), userId, category)}`;
}
const unsubscribeHeaders = (url: string) => ({
  "List-Unsubscribe": `<${url}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

/** Due-review digest: one email (+ one push) per user per local day, after their reminder time. */
export async function runReviewDigest(now = new Date()) {
  const rows = await db().execute<Candidate & { due: number }>(sql`
    select p.user_id, u.email, p.timezone, p.locale, p.email_reviews, p.email_weekly, p.work_hours,
           p.weekly_focus_goal_minutes,
           (select count(*)::int from learning_item li
              where li.user_id = p.user_id and li.status = 'active'
                and li.due_on <= (${now}::timestamptz at time zone p.timezone)::date) as due
    from user_preferences p join "user" u on u.id = p.user_id
    where u.email_verified
      and to_char(${now}::timestamptz at time zone p.timezone, 'HH24:MI') >= p.daily_reminder_time
      and (p.email_reviews or exists (select 1 from push_subscription s where s.user_id = p.user_id))
      and exists (select 1 from learning_item li where li.user_id = p.user_id and li.status = 'active'
                    and li.due_on <= (${now}::timestamptz at time zone p.timezone)::date)
    limit ${BATCH}`);
  let emails = 0;
  let pushes = 0;
  for (const user of rows.rows) {
    const today = localDate(user.timezone, now);
    const locale = localeOf(user.locale);
    const reviewUrl = `${appUrl()}/${locale}/app/review`;
    if (user.email_reviews)
      if (
        await sendOnce(
          user.user_id,
          "review_digest",
          "email",
          today,
          async () => {
            const due = await db().execute<{
              topic: string;
              questions: number;
            }>(sql`
            select li.topic, (select count(*)::int from question q where q.learning_item_id = li.id) as questions
            from learning_item li
            where li.user_id = ${user.user_id} and li.status = 'active' and li.due_on <= ${today}::date
            order by li.due_on, li.created_at limit 50`);
            if (!due.rows.length) return "skipped";
            const t = await emailTranslator(locale);
            const questions = due.rows.reduce((sum, r) => sum + r.questions, 0);
            const minutes = Math.max(2, Math.ceil(questions * 0.5));
            const unsubscribe = unsubscribeUrl(user.user_id, "reviews");
            const copy = {
              preview: t("digest.preview", { count: user.due }),
              heading: t("digest.heading", { count: user.due }),
              intro: t("digest.intro"),
              more:
                user.due > DIGEST_TOPICS
                  ? t("digest.more", { count: user.due - DIGEST_TOPICS })
                  : null,
              estimate: t("digest.estimate", { minutes }),
              button: t("digest.button"),
              footer: t("footer.reviews"),
              unsubscribe: t("footer.unsubscribe"),
            };
            await deliver({
              to: user.email,
              subject: t("digest.subject", { count: user.due }),
              kind: "review_digest",
              url: reviewUrl,
              from: getEnv().REMINDER_EMAIL_FROM,
              headers: unsubscribeHeaders(unsubscribe),
              react: (
                <ReviewDigestEmail
                  locale={locale}
                  topics={due.rows.slice(0, DIGEST_TOPICS).map((r) => r.topic)}
                  url={reviewUrl}
                  unsubscribeUrl={unsubscribe}
                  copy={copy}
                />
              ),
            });
            return "sent";
          },
        )
      )
        emails += 1;
    if (pushConfigured())
      if (
        await sendOnce(
          user.user_id,
          "review_digest",
          "push",
          today,
          async () => {
            const t = await emailTranslator(locale);
            return sendPush(user.user_id, {
              title: t("push.reviewsTitle", { count: user.due }),
              body: t("push.reviewsBody"),
              url: `/${locale}/app/review`,
              tag: "review-digest",
            });
          },
        )
      )
        pushes += 1;
  }
  return { candidates: rows.rows.length, emails, pushes };
}

/** Weekly report for Pro users, Monday at 09:00 local time, about the previous week. */
export async function runWeeklyReport(now = new Date()) {
  const rows = await db().execute<Candidate>(sql`
    select p.user_id, u.email, p.timezone, p.locale, p.email_reviews, p.email_weekly, p.work_hours, p.weekly_focus_goal_minutes
    from user_preferences p join "user" u on u.id = p.user_id
    where u.email_verified and p.email_weekly
      and extract(isodow from ${now}::timestamptz at time zone p.timezone) = 1
      and to_char(${now}::timestamptz at time zone p.timezone, 'HH24:MI') >= '09:00'
      and not exists (select 1 from notification_log n where n.user_id = p.user_id and n.kind = 'weekly_report'
        and n.period_key = to_char((${now}::timestamptz at time zone p.timezone)::date, 'IYYY-"W"IW') and n.status in ('sent', 'skipped'))
    limit ${BATCH}`);
  let sent = 0;
  for (const user of rows.rows) {
    if (!(await hasEntitlement(user.user_id))) continue;
    const today = localDate(user.timezone, now);
    const week = isoWeekKey(today);
    const locale = localeOf(user.locale);
    const ok = await sendOnce(
      user.user_id,
      "weekly_report",
      "email",
      week,
      async () => {
        const from = addDays(startOfWeek(today, 1), -7);
        const to = addDays(from, 6);
        const range = { timezone: user.timezone, from, to };
        const [focus, learning, ranking, days, content, t] = await Promise.all([
          focusSummary(user.user_id, range),
          learningSummary(user.user_id, range),
          techniqueRanking(user.user_id, range),
          streakDays(user.user_id, user.timezone),
          getTechniqueContent(locale),
          emailTranslator(locale),
        ]);
        const best = ranking[0]?.technique;
        const bestName = best
          ? (content[best as keyof typeof content]?.name ?? best)
          : null;
        const focusedMinutes = Math.round(focus.seconds / 60);
        const nf = new Intl.NumberFormat(locale);
        const suggestion = weeklySuggestion({
          focusedMinutes,
          goalMinutes: user.weekly_focus_goal_minutes,
          reviews: learning.reviews,
          retention: learning.retention,
          bestTechnique: bestName,
        });
        // The first report of a month also recaps the month before.
        let recap = null;
        if (Number(today.slice(8, 10)) <= 7) {
          const month = previousMonth(today);
          const monthRange = {
            timezone: user.timezone,
            from: month.from,
            to: month.to,
          };
          const [monthLearning, topics] = await Promise.all([
            learningSummary(user.user_id, monthRange),
            topicsCreated(user.user_id, monthRange),
          ]);
          const monthName = new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${month.from}T12:00:00Z`));
          if (monthLearning.cards > 0)
            recap = {
              title: t("weekly.recapTitle", { month: monthName }),
              text: t("weekly.recapText", {
                cards: monthLearning.cards,
                retention:
                  monthLearning.retention === null
                    ? "–"
                    : `${nf.format(Math.round(monthLearning.retention * 100))}%`,
              }),
              topics,
            };
        }
        const percent = (value: number | null) =>
          value === null ? "–" : `${nf.format(Math.round(value * 100))}%`;
        const copy = {
          preview: t("weekly.preview", { minutes: focusedMinutes }),
          heading: t("weekly.heading"),
          intro: t("weekly.intro"),
          stats: [
            {
              label: t("weekly.focus"),
              value: t("weekly.minutes", { minutes: focusedMinutes }),
            },
            { label: t("weekly.sessions"), value: nf.format(focus.sessions) },
            { label: t("weekly.best"), value: bestName ?? "–" },
            { label: t("weekly.cards"), value: nf.format(learning.cards) },
            {
              label: t("weekly.retention"),
              value: percent(learning.retention),
            },
            {
              label: t("weekly.streak"),
              value: t("weekly.days", { count: computeStreak(days, today) }),
            },
          ],
          suggestionTitle: t("weekly.suggestionTitle"),
          suggestion: t(
            `weekly.suggestions.${suggestion.key}`,
            suggestion as never,
          ),
          recap,
          button: t("weekly.button"),
          footer: t("footer.weekly"),
          unsubscribe: t("footer.unsubscribe"),
        };
        const unsubscribe = unsubscribeUrl(user.user_id, "weekly");
        await deliver({
          to: user.email,
          subject: t("weekly.subject"),
          kind: "weekly_report",
          url: `${appUrl()}/${locale}/app/stats`,
          from: getEnv().REMINDER_EMAIL_FROM,
          headers: unsubscribeHeaders(unsubscribe),
          react: (
            <WeeklyReportEmail
              locale={locale}
              url={`${appUrl()}/${locale}/app/stats`}
              unsubscribeUrl={unsubscribe}
              copy={copy}
            />
          ),
        });
        return "sent";
      },
    );
    if (ok) sent += 1;
  }
  return { candidates: rows.rows.length, sent };
}

/** Opt-in gentle push at 19:00 local when a 3+ day streak would break today. */
export async function runStreakNudge(now = new Date()) {
  if (!pushConfigured()) return { candidates: 0, sent: 0 };
  const rows = await db().execute<Candidate>(sql`
    select p.user_id, u.email, p.timezone, p.locale, p.email_reviews, p.email_weekly, p.work_hours, p.weekly_focus_goal_minutes
    from user_preferences p join "user" u on u.id = p.user_id
    where u.email_verified and p.streak_nudge
      and to_char(${now}::timestamptz at time zone p.timezone, 'HH24:MI') >= '19:00'
      and exists (select 1 from push_subscription s where s.user_id = p.user_id)
      and not exists (select 1 from focus_session f where f.user_id = p.user_id and f.completed
        and (f.started_at at time zone p.timezone)::date = (${now}::timestamptz at time zone p.timezone)::date)
    limit ${BATCH}`);
  let sent = 0;
  for (const user of rows.rows) {
    const parts = zonedParts(user.timezone, now);
    const window = user.work_hours?.[String(parts.weekday) as keyof WorkHours];
    if (!window || !withinWindow(parts.time, window.start, window.end))
      continue;
    const today = parts.date;
    const streak = computeStreak(
      await streakDays(user.user_id, user.timezone),
      today,
    );
    if (streak < 3) continue;
    const locale = localeOf(user.locale);
    const ok = await sendOnce(
      user.user_id,
      "streak_nudge",
      "push",
      today,
      async () => {
        const t = await emailTranslator(locale);
        return sendPush(user.user_id, {
          title: t("push.streakTitle", { count: streak }),
          body: t("push.streakBody"),
          url: `/${locale}/app/focus`,
          tag: "streak-nudge",
        });
      },
    );
    if (ok) sent += 1;
  }
  return { candidates: rows.rows.length, sent };
}

/** Daily housekeeping. Idempotent. */
export async function runCleanup() {
  const notifications = await db().execute(
    sql`delete from notification_log where created_at < now() - interval '180 days'`,
  );
  const previews = await db().execute(
    sql`delete from email_preview where created_at < now() - interval '7 days'`,
  );
  const drafts = await db().execute(
    sql`delete from learning_draft where updated_at < now() - interval '30 days'`,
  );
  const limits = await db().execute(
    sql`delete from rate_limit where key like 'app:%' and last_request < ${Date.now() - 2 * 86_400_000}`,
  );
  const result = {
    notifications: notifications.rowCount ?? 0,
    previews: previews.rowCount ?? 0,
    drafts: drafts.rowCount ?? 0,
    rateLimits: limits.rowCount ?? 0,
  };
  logger.info(result, "Cleanup finished");
  return result;
}
