// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { booking, referral, subscription } from "@/src/lib/db/schema";
import { getEnv } from "@/src/config/env";
import { polar, products } from "@/src/lib/billing/provider";
import { trackForUser } from "@/src/lib/analytics/product";
import * as notify from "@/src/lib/notifications";
import { logger } from "@/src/lib/logger";

/**
 * A month of Plus for one person: a single-use 100% discount for one month.
 * Applied to their current subscription when they have one, otherwise
 * returned as a code for their next checkout.
 */
async function grantFreeMonth(userId: string, referralId: string) {
  const plusProducts = Object.values(products()).filter(Boolean) as string[];
  const code = `FRIEND-${randomBytes(4).toString("hex").toUpperCase()}`;
  const discount = await polar().discounts.create({
    type: "percentage",
    basis_points: 10000,
    duration: "repeating",
    duration_in_months: 1,
    name: "Referral: one free month",
    code,
    max_redemptions: 1,
    products: plusProducts.length ? plusProducts : null,
    metadata: { referral_id: referralId, user_id: userId },
  });
  const [active] = await db()
    .select()
    .from(subscription)
    .where(
      and(eq(subscription.userId, userId), eq(subscription.status, "active")),
    );
  if (active) {
    try {
      await polar().subscriptions.update(active.id, {
        discount_id: discount.id,
      });
      return null;
    } catch (error) {
      logger.warn(
        { err: error },
        "Could not apply referral discount to subscription",
      );
    }
  }
  return code;
}

/** Called after someone completes a session. Converts their pending referral on the first one. */
export async function convertReferral(refereeId: string, now = new Date()) {
  const [pending] = await db()
    .select()
    .from(referral)
    .where(
      and(eq(referral.refereeId, refereeId), eq(referral.status, "pending")),
    );
  if (!pending) return false;
  const [{ n }] = await db()
    .select({ n: count() })
    .from(booking)
    .where(and(eq(booking.userId, refereeId), eq(booking.status, "completed")));
  if (n < 1) return false;

  const claimed = await db()
    .update(referral)
    .set({ status: "converted", convertedAt: now })
    .where(and(eq(referral.id, pending.id), eq(referral.status, "pending")))
    .returning();
  if (!claimed.length) return false;
  void trackForUser(pending.referrerId, "referral_converted");

  const env = getEnv();
  if (!env.BILLING_ENABLED || !env.POLAR_ACCESS_TOKEN) return true;
  try {
    const referrerCode = await grantFreeMonth(pending.referrerId, pending.id);
    const refereeCode = await grantFreeMonth(pending.refereeId, pending.id);
    await db()
      .update(referral)
      .set({
        status: "rewarded",
        rewardedAt: new Date(),
        referrerDiscountCode: referrerCode,
        refereeDiscountCode: refereeCode,
      })
      .where(eq(referral.id, pending.id));
    await notify.referralRewarded(
      pending.referrerId,
      `${pending.id}:r`,
      referrerCode,
    );
    await notify.referralRewarded(
      pending.refereeId,
      `${pending.id}:e`,
      refereeCode,
    );
  } catch (error) {
    // Stays "converted"; the worker retries rewards for converted referrals.
    logger.error({ err: error }, "Referral reward failed");
  }
  return true;
}

/** Retries rewards that failed after conversion. */
export async function retryReferralRewards() {
  const env = getEnv();
  if (!env.BILLING_ENABLED || !env.POLAR_ACCESS_TOKEN) return 0;
  const rows = await db()
    .select()
    .from(referral)
    .where(eq(referral.status, "converted"))
    .limit(20);
  for (const r of rows) {
    await db()
      .update(referral)
      .set({ status: "pending" })
      .where(eq(referral.id, r.id));
    await convertReferral(r.refereeId, r.convertedAt ?? new Date());
  }
  return rows.length;
}

/** The unused discount code waiting for this user's next checkout, if any. */
export async function pendingDiscountCode(userId: string) {
  const rows = await db()
    .select()
    .from(referral)
    .where(eq(referral.status, "rewarded"));
  for (const r of rows) {
    if (r.referrerId === userId && r.referrerDiscountCode)
      return r.referrerDiscountCode;
    if (r.refereeId === userId && r.refereeDiscountCode)
      return r.refereeDiscountCode;
  }
  return null;
}
