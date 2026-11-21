import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/src/lib/db";

/**
 * Fixed-window limiter on the boilerplate's rate_limit table. Returns false
 * once `max` requests were made for `key` within `windowSeconds`.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  const now = Date.now();
  const id = `app:${key}`;
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
