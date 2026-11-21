import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { block, profile, report, sessionParticipant } from "@/src/lib/db/schema";
import { notifyAdmins } from "@/src/lib/notifications";

export const REPORT_REASONS = [
  "inappropriate",
  "harassment",
  "no_camera",
  "spam",
  "underage",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Reports from this many different people within 30 days pause the account until review. */
export const AUTO_SUSPEND_REPORTERS = 3;

async function sharedSession(a: string, b: string, sessionId: string) {
  const rows = await db()
    .select({ userId: sessionParticipant.userId })
    .from(sessionParticipant)
    .where(eq(sessionParticipant.sessionId, sessionId));
  const ids = new Set(rows.map((r) => r.userId));
  return ids.has(a) && ids.has(b);
}

export async function blockUser(blockerId: string, blockedId: string, sessionId?: string) {
  if (blockerId === blockedId) return false;
  await db()
    .insert(block)
    .values({ blockerId, blockedId, sessionId: sessionId ?? null })
    .onConflictDoNothing();
  return true;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await db()
    .delete(block)
    .where(and(eq(block.blockerId, blockerId), eq(block.blockedId, blockedId)));
}

export async function reportUser(input: {
  reporterId: string;
  targetId: string;
  sessionId?: string;
  reason: ReportReason;
  details: string;
}) {
  if (input.reporterId === input.targetId) return null;
  // Reports tied to a session must come from someone who was in it.
  if (input.sessionId && !(await sharedSession(input.reporterId, input.targetId, input.sessionId)))
    return null;
  const id = crypto.randomUUID();
  await db().insert(report).values({
    id,
    reporterId: input.reporterId,
    targetId: input.targetId,
    sessionId: input.sessionId ?? null,
    reason: input.reason,
    details: input.details.slice(0, 2000),
  });
  // Reporting always blocks too, so the two are never matched again.
  await blockUser(input.reporterId, input.targetId, input.sessionId);

  const since = new Date(Date.now() - 30 * 86_400_000);
  const [{ n }] = await db()
    .select({ n: count(report.reporterId) })
    .from(report)
    .where(and(eq(report.targetId, input.targetId), gte(report.createdAt, since)));
  const reporters = await db()
    .selectDistinct({ id: report.reporterId })
    .from(report)
    .where(and(eq(report.targetId, input.targetId), gte(report.createdAt, since)));
  const urgent = input.reason === "underage" || input.reason === "inappropriate";
  if (reporters.length >= AUTO_SUSPEND_REPORTERS || (urgent && reporters.length >= 2))
    await db()
      .update(profile)
      .set({ suspendedAt: new Date() })
      .where(eq(profile.userId, input.targetId));
  void notifyAdmins(
    "report",
    id,
    `New report: ${input.reason}`,
    [`A member reported another member (${n} report(s) on this account in 30 days).`, "Review it in the admin panel."],
    "/admin/reports",
  ).catch(() => {});
  return id;
}
