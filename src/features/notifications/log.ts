import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { notificationLog } from "@/src/lib/db/schema";

export const MAX_ATTEMPTS = 3;

/**
 * Claims one send for (user, kind, channel, period) BEFORE sending. The
 * unique key makes concurrent cron calls safe: only one caller gets the row.
 * Failed sends (and pending rows abandoned for 10 minutes) are retried on
 * later ticks, up to MAX_ATTEMPTS.
 */
export async function claimNotification(
  userId: string,
  kind: string,
  channel: "email" | "push",
  periodKey: string,
) {
  const result = await db().execute<{ id: string }>(sql`
    insert into notification_log (id, user_id, kind, channel, period_key, status, attempts, created_at, updated_at)
    values (${crypto.randomUUID()}, ${userId}, ${kind}, ${channel}, ${periodKey}, 'pending', 1, now(), now())
    on conflict (user_id, kind, channel, period_key) do update
      set status = 'pending', attempts = notification_log.attempts + 1, updated_at = now(), error = null
      where notification_log.attempts < ${MAX_ATTEMPTS}
        and (notification_log.status = 'failed'
          or (notification_log.status = 'pending' and notification_log.updated_at < now() - interval '10 minutes'))
    returning id`);
  return result.rows[0]?.id ?? null;
}

export async function markNotification(
  id: string,
  status: "sent" | "failed" | "skipped",
  error?: string,
) {
  await db()
    .update(notificationLog)
    .set({
      status,
      error: error ? error.slice(0, 200) : null,
      sentAt: status === "sent" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(notificationLog.id, id));
}

/** Runs one claimed send and records the outcome. Returns true when sent. */
export async function sendOnce(
  userId: string,
  kind: string,
  channel: "email" | "push",
  periodKey: string,
  send: () => Promise<"sent" | "skipped">,
) {
  const id = await claimNotification(userId, kind, channel, periodKey);
  if (!id) return false;
  try {
    const status = await send();
    await markNotification(id, status);
    return status === "sent";
  } catch (error) {
    await markNotification(
      id,
      "failed",
      error instanceof Error ? error.name : "error",
    );
    return false;
  }
}
