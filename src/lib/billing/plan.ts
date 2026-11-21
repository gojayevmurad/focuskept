import "server-only";
import { and, count, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  booking,
  community,
  communityMember,
  host,
  profile,
} from "@/src/lib/db/schema";
import { getEnv } from "@/src/config/env";
import { hasEntitlement } from "./entitlements";
import { weekBounds } from "@/src/lib/scheduling/slots";

export type PlanName = "free" | "plus";
export type PlanReason =
  "billing_disabled" | "subscription" | "house" | "host" | "community" | "none";

/** Statuses that use up one of the free weekly sessions. */
export const COUNTED_STATUSES = [
  "booked",
  "matched",
  "completed",
  "no_show",
  "late_cancel",
] as const;

export async function getPlan(
  userId: string,
): Promise<{ plan: PlanName; reason: PlanReason }> {
  const env = getEnv();
  if (!env.BILLING_ENABLED) return { plan: "plus", reason: "billing_disabled" };

  const [prof] = await db()
    .select({ isHouse: profile.isHouse })
    .from(profile)
    .where(eq(profile.userId, userId));
  if (prof?.isHouse) return { plan: "plus", reason: "house" };

  const now = new Date();
  const [perk] = await db()
    .select({ until: host.perkUntil })
    .from(host)
    .where(
      and(
        eq(host.userId, userId),
        eq(host.status, "approved"),
        gt(host.perkUntil, now),
      ),
    );
  if (perk) return { plan: "plus", reason: "host" };

  const [licensed] = await db()
    .select({ id: community.id })
    .from(communityMember)
    .innerJoin(community, eq(community.id, communityMember.communityId))
    .where(
      and(
        eq(communityMember.userId, userId),
        gt(community.licenseUntil, now),
        sql`(select count(*) from ${communityMember} m where m.community_id = ${community.id} and m.joined_at <= ${communityMember.joinedAt}) <= ${community.plusSeats}`,
      ),
    )
    .limit(1);
  if (licensed) return { plan: "plus", reason: "community" };

  try {
    if (await hasEntitlement(userId))
      return { plan: "plus", reason: "subscription" };
  } catch {
    // Billing reconciliation failures fail closed to the free plan.
  }
  return { plan: "free", reason: "none" };
}

export async function weeklyUsage(
  userId: string,
  timeZone: string,
  at: Date = new Date(),
) {
  const { start, end } = weekBounds(at, timeZone);
  const [row] = await db()
    .select({ n: count() })
    .from(booking)
    .where(
      and(
        eq(booking.userId, userId),
        gte(booking.startAt, start),
        lt(booking.startAt, end),
        inArray(booking.status, [...COUNTED_STATUSES]),
      ),
    );
  return {
    used: row?.n ?? 0,
    limit: getEnv().FREE_WEEKLY_SESSIONS,
    start,
    end,
  };
}

/** Free users get a fixed number of sessions per local week; Plus is unlimited. */
export async function canBookAnother(
  userId: string,
  timeZone: string,
  startAt: Date,
) {
  const { plan } = await getPlan(userId);
  if (plan === "plus") return { ok: true as const, plan };
  const usage = await weeklyUsage(userId, timeZone, startAt);
  return usage.used < usage.limit
    ? { ok: true as const, plan, usage }
    : { ok: false as const, plan, usage };
}
