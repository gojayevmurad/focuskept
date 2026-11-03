import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { addDays } from "@/src/lib/dates";

/** Local-day range [from, to] inclusive, evaluated in the user's timezone. */
type Range = { timezone: string; from: string; to: string };

const localDay = (column: string, timezone: string) =>
  sql
    .raw(`(${column} at time zone `)
    .append(sql`${timezone}`)
    .append(sql.raw(`)::date`));

export async function focusSummary(userId: string, range: Range) {
  const day = localDay("started_at", range.timezone);
  const result = await db().execute<{
    seconds: number;
    sessions: number;
    rated: number;
    avg_rating: number | null;
  }>(sql`
    select coalesce(sum(focused_seconds), 0)::int as seconds,
           count(*)::int as sessions,
           count(focus_rating)::int as rated,
           avg(focus_rating)::float as avg_rating
    from focus_session
    where user_id = ${userId} and completed and ${day} between ${range.from}::date and ${range.to}::date`);
  return result.rows[0];
}

/** Techniques ranked by average focus rating (ties → more sessions). */
export async function techniqueRanking(
  userId: string,
  range: Range | null,
  minRated = 1,
) {
  const filter = range
    ? sql`and ${localDay("started_at", range.timezone)} between ${range.from}::date and ${range.to}::date`
    : sql``;
  const result = await db().execute<{
    technique: string;
    sessions: number;
    rated: number;
    avg_rating: number | null;
    minutes: number;
  }>(sql`
    select time_technique as technique,
           count(*)::int as sessions,
           count(focus_rating)::int as rated,
           avg(focus_rating)::float as avg_rating,
           (coalesce(sum(focused_seconds), 0) / 60)::int as minutes
    from focus_session
    where user_id = ${userId} and completed ${filter}
    group by time_technique
    order by avg(focus_rating) desc nulls last, count(*) desc`);
  return result.rows.filter((r) => r.rated >= minRated);
}

export async function learningSummary(userId: string, range: Range) {
  const created = localDay("created_at", range.timezone);
  const reviewed = localDay("completed_at", range.timezone);
  const result = await db().execute<{
    cards: number;
    reviews: number;
    passed: number;
  }>(sql`
    select
      (select count(*)::int from learning_item where user_id = ${userId} and ${created} between ${range.from}::date and ${range.to}::date) as cards,
      (select count(*)::int from review where user_id = ${userId} and not was_early and ${reviewed} between ${range.from}::date and ${range.to}::date) as reviews,
      (select count(*)::int from review where user_id = ${userId} and not was_early and passed and ${reviewed} between ${range.from}::date and ${range.to}::date) as passed`);
  const row = result.rows[0];
  return { ...row, retention: row.reviews ? row.passed / row.reviews : null };
}

export async function topicsCreated(userId: string, range: Range, limit = 8) {
  const created = localDay("created_at", range.timezone);
  const result = await db().execute<{ topic: string }>(sql`
    select topic from learning_item
    where user_id = ${userId} and ${created} between ${range.from}::date and ${range.to}::date
    group by topic order by min(created_at) limit ${limit}`);
  return result.rows.map((r) => r.topic);
}

/** Last calendar month relative to `today`. */
export function previousMonth(today: string) {
  const firstOfThis = `${today.slice(0, 7)}-01`;
  const lastOfPrev = addDays(firstOfThis, -1);
  return {
    from: `${lastOfPrev.slice(0, 7)}-01`,
    to: lastOfPrev,
    month: lastOfPrev.slice(0, 7),
  };
}

/** Focus minutes per local day in [from, to], with empty days filled in. */
export async function dailyFocus(userId: string, range: Range) {
  const day = localDay("started_at", range.timezone);
  const result = await db().execute<{
    day: string;
    minutes: number;
    sessions: number;
  }>(sql`
    select to_char(${day}, 'YYYY-MM-DD') as day,
           (sum(focused_seconds) / 60)::int as minutes,
           count(*)::int as sessions
    from focus_session
    where user_id = ${userId} and completed and ${day} between ${range.from}::date and ${range.to}::date
    group by 1`);
  const byDay = new Map(result.rows.map((r) => [r.day, r]));
  const days: { day: string; minutes: number; sessions: number }[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1))
    days.push(byDay.get(d) ?? { day: d, minutes: 0, sessions: 0 });
  return days;
}

/** Average focus rating and minutes by local hour of day (Lab). */
export async function focusByHour(
  userId: string,
  timezone: string,
  sinceDays: number | null,
) {
  const since =
    sinceDays === null
      ? sql``
      : sql`and started_at > now() - make_interval(days => ${sinceDays})`;
  const result = await db().execute<{
    hour: number;
    sessions: number;
    minutes: number;
    avg_rating: number | null;
  }>(sql`
    select extract(hour from started_at at time zone ${timezone})::int as hour,
           count(*)::int as sessions,
           (sum(focused_seconds) / 60)::int as minutes,
           avg(focus_rating)::float as avg_rating
    from focus_session
    where user_id = ${userId} and completed ${since}
    group by 1 order by 1`);
  return result.rows;
}

/** Average focus rating per technique within each task tag (Lab). */
export async function focusByTag(userId: string) {
  const result = await db().execute<{
    tag: string;
    technique: string;
    sessions: number;
    avg_rating: number | null;
  }>(sql`
    select tag, s.time_technique as technique, count(*)::int as sessions, avg(s.focus_rating)::float as avg_rating
    from focus_session s join task t on t.id = s.task_id, unnest(t.tags) as tag
    where s.user_id = ${userId} and s.completed
    group by tag, s.time_technique
    order by tag, avg(s.focus_rating) desc nulls last, count(*) desc`);
  return result.rows;
}

/** Pass rate per review step ("retention curve") over a window. */
export async function retentionByStep(
  userId: string,
  sinceDays: number | null,
) {
  const since =
    sinceDays === null
      ? sql``
      : sql`and completed_at > now() - make_interval(days => ${sinceDays})`;
  const result = await db().execute<{
    step: number;
    reviews: number;
    passed: number;
  }>(sql`
    select step_before as step, count(*)::int as reviews, count(*) filter (where passed)::int as passed
    from review where user_id = ${userId} and not was_early ${since}
    group by step_before order by step_before`);
  return result.rows;
}

export async function retentionByTopic(userId: string, sinceDays: number) {
  const result = await db().execute<{
    topic: string;
    reviews: number;
    passed: number;
  }>(sql`
    select li.topic, count(*)::int as reviews, count(*) filter (where r.passed)::int as passed
    from review r join learning_item li on li.id = r.learning_item_id
    where r.user_id = ${userId} and not r.was_early and r.completed_at > now() - make_interval(days => ${sinceDays})
    group by li.topic order by count(*) desc limit 20`);
  return result.rows;
}

/** Overall retention for the last N days. */
export async function retentionSince(userId: string, sinceDays: number) {
  const result = await db().execute<{ reviews: number; passed: number }>(sql`
    select count(*)::int as reviews, count(*) filter (where passed)::int as passed
    from review where user_id = ${userId} and not was_early and completed_at > now() - make_interval(days => ${sinceDays})`);
  const row = result.rows[0];
  return { ...row, rate: row.reviews ? row.passed / row.reviews : null };
}

export async function lastSession(userId: string) {
  const result = await db().execute<{
    time_technique: string;
    mode: string;
    focused_seconds: number;
    focus_rating: number | null;
    ended_at: Date;
    goal: string;
  }>(sql`
    select time_technique, mode, focused_seconds, focus_rating, ended_at, goal
    from focus_session where user_id = ${userId} and completed
    order by started_at desc limit 1`);
  const row = result.rows[0];
  // Raw queries return timestamps as strings.
  return row ? { ...row, ended_at: new Date(row.ended_at) } : null;
}

export async function lifetimeTotals(userId: string) {
  const result = await db().execute<{
    minutes: number;
    sessions: number;
    cards: number;
    reviews: number;
  }>(sql`
    select
      (select coalesce(sum(focused_seconds), 0) / 60 from focus_session where user_id = ${userId} and completed)::int as minutes,
      (select count(*) from focus_session where user_id = ${userId} and completed)::int as sessions,
      (select count(*) from learning_item where user_id = ${userId})::int as cards,
      (select count(*) from review where user_id = ${userId} and not was_early)::int as reviews`);
  return result.rows[0];
}
