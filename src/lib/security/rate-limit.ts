// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/src/lib/db";

/**
 * Fixed-window limiter on the boilerplate's rate_limit table. Returns false
 * once `max` requests were made for `key` within `windowSeconds`.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
) {
  if (!key || typeof key !== "string" || max <= 0 || windowSeconds <= 0) {
    return false;
  }
  const cleanKey = key.trim().slice(0, 200);
  const now = Date.now();
  const id = `app:${cleanKey}`;
  const result = await db().execute<{ count: number }>(sql`
    insert into rate_limit (id, key, count, last_request)
    values (${id}, ${id}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limit.last_request < ${now - windowSeconds * 1000} then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request < ${now - windowSeconds * 1000} then ${now} else rate_limit.last_request end
    returning count
  `);
  return Number(result.rows[0]?.count ?? 0) <= max;
}
