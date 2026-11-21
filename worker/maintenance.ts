// SPDX-License-Identifier: AGPL-3.0-only
import { lt, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { appConfig, emailPreview, rateLimit } from "@/src/lib/db/schema";

export async function heartbeat(now: Date) {
  await db()
    .insert(appConfig)
    .values({ key: "worker_heartbeat", value: now.toISOString() })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { value: now.toISOString() },
    });
}

export async function cleanup(now: Date) {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  await db().delete(emailPreview).where(lt(emailPreview.createdAt, weekAgo));
  // Better Auth stores lastRequest in milliseconds.
  await db()
    .delete(rateLimit)
    .where(lt(rateLimit.lastRequest, sql`${now.getTime() - 24 * 3600_000}`));
}
