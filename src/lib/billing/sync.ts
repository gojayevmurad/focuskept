import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  billingCustomer,
  entitlement,
  subscription,
  processedEvent,
  user,
  analyticsOutbox,
} from "@/src/lib/db/schema";
import { polar } from "./provider";
import { getEnv } from "@/src/config/env";
// Lock BEFORE fetching authoritative state. Every writer uses the same customer lock.
export async function reconcile(
  userId: string,
  event?: { id: string; type: string; resourceId?: string },
) {
  return db().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = '20s'`);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${userId},0))`,
    );
    if (
      event &&
      (
        await tx
          .select()
          .from(processedEvent)
          .where(eq(processedEvent.id, event.id))
      ).length
    )
      return "duplicate";
    if (
      !(await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)))
        .length
    )
      return "unknown-user";
    const state = await polar().customers.getStateExternal(userId);
    if (state.external_id !== userId)
      throw new Error("Provider customer mismatch");
    const pro = state.granted_benefits.some(
      (b) => b.benefit_id === getEnv().POLAR_PRO_BENEFIT_ID,
    );
    await tx
      .insert(billingCustomer)
      .values({ userId, customerId: state.id, syncedAt: new Date() })
      .onConflictDoUpdate({
        target: billingCustomer.userId,
        set: { customerId: state.id, syncedAt: new Date() },
      });
    await tx.delete(subscription).where(eq(subscription.userId, userId));
    for (const s of state.active_subscriptions)
      await tx.insert(subscription).values({
        id: s.id,
        userId,
        productId: s.product_id,
        status: s.status === "granted" ? "active" : s.status,
        periodEnd: new Date(s.current_period_end),
        cancelAtPeriodEnd: s.cancel_at_period_end,
      });
    // Short lease fails closed if reconciliation is unavailable. Benefits also cover one-time purchases and refunds.
    const value = {
      pro,
      validUntil: new Date(Date.now() + 15 * 60 * 1000),
      source: "polar",
    };
    await tx
      .insert(entitlement)
      .values({ userId, ...value })
      .onConflictDoUpdate({ target: entitlement.userId, set: value });
    if (event) {
      const [owner] = await tx
        .select({ consent: user.analyticsConsent })
        .from(user)
        .where(eq(user.id, userId));
      if (owner.consent && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        let name: string | undefined;
        if (event.type === "order.paid" && event.resourceId) {
          const order = await polar().orders.get(event.resourceId);
          if (order.customer_id !== state.id)
            throw new Error("Order customer mismatch");
          if (order.paid && order.refunded_amount === 0)
            name = "payment_completed";
        }
        if (
          event.type === "subscription.active" &&
          state.active_subscriptions.some(
            (s) => s.id === event.resourceId && s.status !== "disabled",
          )
        )
          name = "subscription_started";
        if (
          event.type === "subscription.canceled" &&
          !state.active_subscriptions.some(
            (s) => s.id === event.resourceId && !s.cancel_at_period_end,
          )
        )
          name = "subscription_canceled";
        if (name)
          await tx
            .insert(analyticsOutbox)
            .values({ id: event.id, userId, event: name })
            .onConflictDoNothing();
      }
      await tx
        .insert(processedEvent)
        .values({ id: event.id, type: event.type });
    }
    return "synchronized";
  });
}
