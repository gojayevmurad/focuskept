// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { sql, inArray } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { appConfig } from "@/src/lib/db/schema";
import { localDayStart } from "@/src/lib/scheduling/slots";
import { MATCH_WAIT_MS } from "@/src/lib/matching/instant";
import { getSupportTicketCounts } from "@/src/lib/support/admin";

export function matchRate(matched: number, failed: number): number {
  return matched + failed === 0 ? 0 : matched / (matched + failed);
}

export async function periodMetrics(days: 7 | 30, now = new Date()) {
  const from = new Date(now.getTime() - days * 86400000).toISOString();
  const to = now.toISOString();
  const result = await db().execute<{
    signups: number;
    bookings: number;
    completed: number;
    matched: number;
    failed: number;
    noShows: number;
    lateCancels: number;
  }>(sql`select
    (select count(*)::int from "user" where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz) as signups,
    (select count(*)::int from booking where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz) as bookings,
    count(*) filter (where status = 'completed')::int as completed,
    count(*) filter (where kind = 'pair' and session_id is not null)::int as matched,
    (select count(*)::int from match_failure where start_at >= ${from}::timestamptz and start_at < ${to}::timestamptz and resolution is distinct from 'matched_late') as failed,
    count(*) filter (where status = 'no_show')::int as "noShows",
    count(*) filter (where status = 'late_cancel')::int as "lateCancels"
    from booking where start_at >= ${from}::timestamptz and start_at < ${to}::timestamptz`);
  const row = result.rows[0];
  return {
    ...row,
    matchRate: matchRate(row.matched, row.failed),
    noShowRate: matchRate(row.noShows, row.completed),
  };
}

export async function currentMetrics() {
  const [counts, config, ticketCounts] = await Promise.all([
    db().execute<{ plus: number; reports: number; hosts: number }>(sql`select
      (select count(*)::int from subscription where status = 'active') as plus,
      (select count(*)::int from report where status = 'open') as reports,
      (select count(*)::int from host where status = 'applied') as hosts`),
    db()
      .select()
      .from(appConfig)
      .where(inArray(appConfig.key, ["video_usage", "worker_heartbeat"])),
    getSupportTicketCounts(),
  ]);
  const usage = config.find((c) => c.key === "video_usage")?.value;
  const heartbeat = config.find((c) => c.key === "worker_heartbeat")?.value;
  return {
    ...counts.rows[0],
    supportTickets: ticketCounts.open,
    usage:
      typeof usage === "object" &&
      usage !== null &&
      "month" in usage &&
      "gb" in usage &&
      typeof usage.month === "string" &&
      typeof usage.gb === "number"
        ? { month: usage.month, gb: usage.gb }
        : null,
    heartbeat:
      typeof heartbeat === "string" && Number.isFinite(Date.parse(heartbeat))
        ? new Date(heartbeat)
        : null,
  };
}

export type OverviewCounts = {
  signupsToday: number;
  signupsWeek: number;
  sessionsToday: number;
  sessionsWeek: number;
  matched: number;
  failed: number;
  reports: number;
  support: number;
  waiting: number;
  unmatched: number;
};
/** Today uses the operator's calendar; seven-day metrics use a rolling window. */
export async function overviewMetrics(timeZone: string, now = new Date()) {
  const today = localDayStart(now, timeZone).toISOString();
  const week = new Date(now.getTime() - 7 * 86400000).toISOString();
  const to = now.toISOString();
  const nextDay = new Date(now.getTime() + 86400000).toISOString();
  const waitCutoff = new Date(now.getTime() - MATCH_WAIT_MS).toISOString();
  const result = await db().execute<OverviewCounts>(sql`select
    (select count(*)::int from "user" where created_at >= ${today}::timestamptz and created_at < ${to}::timestamptz) as "signupsToday",
    (select count(*)::int from "user" where created_at >= ${week}::timestamptz and created_at < ${to}::timestamptz) as "signupsWeek",
    (select count(*)::int from focus_session where start_at >= ${today}::timestamptz and start_at < ${to}::timestamptz and status <> 'cancelled') as "sessionsToday",
    (select count(*)::int from focus_session where start_at >= ${week}::timestamptz and start_at < ${to}::timestamptz and status <> 'cancelled') as "sessionsWeek",
    (select count(*)::int from booking where start_at >= ${week}::timestamptz and start_at < ${to}::timestamptz and kind = 'pair' and session_id is not null) as matched,
    (select count(*)::int from match_failure where start_at >= ${week}::timestamptz and start_at < ${to}::timestamptz and resolution is distinct from 'matched_late') as failed,
    (select count(*)::int from report where status = 'open') as reports,
    (select count(*)::int from support_ticket where status = 'open') as support,
    (select count(*)::int from match_request m join profile p on p.user_id = m.user_id where m.status = 'waiting' and m.created_at > ${waitCutoff}::timestamptz and p.suspended_at is null) as waiting,
    (select count(*)::int from booking where status = 'booked' and kind = 'pair' and session_id is null and start_at > ${to}::timestamptz and start_at <= ${nextDay}::timestamptz) as unmatched`);
  const row = result.rows[0];
  return { ...row, matchRate: matchRate(row.matched, row.failed) };
}
export type AttentionItem = {
  id: string;
  kind: "report" | "support" | "booking";
  label: string;
  at: string;
};
export async function needsAttention(now = new Date()) {
  const result = await db().execute<AttentionItem>(sql`
    (select id, 'report' as kind, reason as label, created_at::text as at from report where status = 'open' order by created_at limit 5)
    union all
    (select id, 'support' as kind, subject as label, created_at::text as at from support_ticket where status = 'open' order by created_at limit 5)
    union all
    (select b.id, 'booking' as kind, p.display_name as label, b.start_at::text as at from booking b join profile p on p.user_id = b.user_id where b.status = 'booked' and b.kind = 'pair' and b.session_id is null and b.start_at > ${now.toISOString()}::timestamptz and b.start_at <= ${new Date(now.getTime() + 86400000).toISOString()}::timestamptz order by b.start_at limit 5)
  `);
  return result.rows;
}
