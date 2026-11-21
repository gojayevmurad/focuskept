// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { sql, inArray } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { appConfig } from "@/src/lib/db/schema";

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
  const [counts, config] = await Promise.all([
    db().execute<{ plus: number; reports: number; hosts: number }>(sql`select
      (select count(*)::int from subscription where status = 'active') as plus,
      (select count(*)::int from report where status = 'open') as reports,
      (select count(*)::int from host where status = 'applied') as hosts`),
    db()
      .select()
      .from(appConfig)
      .where(inArray(appConfig.key, ["video_usage", "worker_heartbeat"])),
  ]);
  const usage = config.find((c) => c.key === "video_usage")?.value;
  const heartbeat = config.find((c) => c.key === "worker_heartbeat")?.value;
  return {
    ...counts.rows[0],
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
