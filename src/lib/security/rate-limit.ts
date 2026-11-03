import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/src/lib/db";

/**
 * Fixed-window counter in the same PostgreSQL `rate_limit` table Better Auth
 * uses (keys are prefixed `app:` so they never collide). One atomic upsert per
 * call: safe under concurrent requests on a single database.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
) {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const result = await db().execute<{
    count: number;
    last_request: string;
  }>(sql`
    insert into rate_limit (id, key, count, last_request)
    values (${crypto.randomUUID()}, ${"app:" + key}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limit.last_request < ${windowStart} then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request < ${windowStart} then ${now} else rate_limit.last_request end
    returning count, last_request
  `);
  const row = result.rows[0];
  const count = Number(row.count);
  const retryAfter = Math.max(
    1,
    Math.ceil((Number(row.last_request) + windowSeconds * 1000 - now) / 1000),
  );
  return { allowed: count <= max, count, retryAfter };
}
