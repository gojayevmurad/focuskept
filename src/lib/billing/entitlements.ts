import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { entitlement, subscription } from "@/src/lib/db/schema";
import { reconcile } from "./sync";
import { canUsePro } from "./policy";
export async function hasEntitlement(userId: string) {
  let [record] = await db()
    .select()
    .from(entitlement)
    .where(eq(entitlement.userId, userId));
  if (record && record.validUntil <= new Date()) {
    try {
      await reconcile(userId);
      [record] = await db()
        .select()
        .from(entitlement)
        .where(eq(entitlement.userId, userId));
    } catch {
      return false;
    }
  }
  return canUsePro(record);
}
export async function requireEntitlement(userId: string) {
  if (!(await hasEntitlement(userId)))
    throw new Error("A Pro entitlement is required");
}
export async function getCurrentPlan(userId: string) {
  return (await hasEntitlement(userId)) ? "Pro" : "Free";
}
export async function hasActiveSubscription(userId: string) {
  const rows = await db()
    .select()
    .from(subscription)
    .where(eq(subscription.userId, userId));
  return rows.some((s) => s.status === "active" && s.periodEnd > new Date());
}
