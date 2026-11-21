import "server-only";
import { and, count, eq, gte, lt, isNotNull } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { focusSession, host } from "@/src/lib/db/schema";
import { getEnv } from "@/src/config/env";

function monthStart(d: Date, offset = 0) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
}

/**
 * Hosts who ran at least HOST_PERK_SESSIONS group sessions last month get
 * Plus until the end of this month. Runs daily; only acts once per month.
 */
export async function updateHostPerks(now = new Date()) {
  const threshold = getEnv().HOST_PERK_SESSIONS;
  const from = monthStart(now, -1);
  const to = monthStart(now);
  const until = monthStart(now, 1);
  const rows = await db()
    .select({ hostId: focusSession.hostId, n: count() })
    .from(focusSession)
    .where(
      and(
        isNotNull(focusSession.hostId),
        eq(focusSession.status, "ended"),
        eq(focusSession.type, "group"),
        gte(focusSession.startAt, from),
        lt(focusSession.startAt, to),
      ),
    )
    .groupBy(focusSession.hostId);
  let granted = 0;
  for (const r of rows) {
    if (!r.hostId || r.n < threshold) continue;
    await db()
      .update(host)
      .set({ perkUntil: until })
      .where(and(eq(host.userId, r.hostId), eq(host.status, "approved")));
    granted++;
  }
  return granted;
}
