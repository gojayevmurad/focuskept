import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/src/lib/db";
import { analyticsOutbox, user } from "@/src/lib/db/schema";
import { trackServer } from "./server";
import type { AnalyticsEvent } from "./events";
export async function flushBillingAnalytics(userId: string) {
  const [owner] = await db()
    .select({ consent: user.analyticsConsent })
    .from(user)
    .where(eq(user.id, userId));
  if (!owner?.consent) return;
  const rows = await db()
    .select()
    .from(analyticsOutbox)
    .where(
      and(eq(analyticsOutbox.userId, userId), isNull(analyticsOutbox.sentAt)),
    )
    .limit(50);
  for (const row of rows) {
    const hex = createHash("sha256").update(row.id).digest("hex");
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    await trackServer(userId, row.event as AnalyticsEvent, {}, true, uuid);
    await db()
      .update(analyticsOutbox)
      .set({ sentAt: new Date() })
      .where(eq(analyticsOutbox.id, row.id));
  }
}
