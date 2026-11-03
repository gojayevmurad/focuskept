import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { user, analyticsOutbox, processedEvent } from "@/src/lib/db/schema";
import { reconcile } from "@/src/lib/billing/sync";
import { flushBillingAnalytics } from "@/src/lib/analytics/outbox";
import { trackServer } from "@/src/lib/analytics/server";
vi.mock("@/src/lib/analytics/server", () => ({
  trackServer: vi.fn(async () => {}),
}));
vi.mock("@/src/lib/billing/provider", () => ({
  polar: () => ({
    customers: {
      getStateExternal: async (id: string) => ({
        id: "analytics-customer",
        external_id: id,
        granted_benefits: [],
        active_subscriptions: [],
      }),
    },
    orders: {
      get: async () => ({
        customer_id: "analytics-customer",
        paid: true,
        refunded_amount: 0,
      }),
    },
  }),
}));
const url = process.env.TEST_DATABASE_URL;
const owner = "analytics-test-user";
beforeAll(async () => {
  if (!url) return;
  if (!new URL(url).pathname.endsWith("_test"))
    throw new Error("Use an isolated _test database");
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "fixture-key");
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
  await db()
    .insert(user)
    .values({
      id: owner,
      name: "Analytics fixture",
      email: "analytics-fixture@example.test",
    })
    .onConflictDoNothing();
});
afterAll(async () => {
  if (url) {
    await db().delete(user).where(eq(user.id, owner));
    await db()
      .delete(processedEvent)
      .where(
        inArray(processedEvent.id, [
          "analytics-without-consent",
          "analytics-with-consent",
        ]),
      );
  }
  vi.unstubAllEnvs();
});
it.skipIf(!url)(
  "requires consent, commits analytics once, and retries with a stable deduplication ID",
  async () => {
    await reconcile(owner, {
      id: "analytics-without-consent",
      type: "order.paid",
      resourceId: "order",
    });
    expect(
      await db()
        .select()
        .from(analyticsOutbox)
        .where(eq(analyticsOutbox.userId, owner)),
    ).toHaveLength(0);
    await db()
      .update(user)
      .set({ analyticsConsent: true })
      .where(eq(user.id, owner));
    await reconcile(owner, {
      id: "analytics-with-consent",
      type: "order.paid",
      resourceId: "order",
    });
    expect(trackServer).not.toHaveBeenCalled();
    expect(
      (
        await db()
          .select()
          .from(analyticsOutbox)
          .where(eq(analyticsOutbox.userId, owner))
      )[0].event,
    ).toBe("payment_completed");
    await reconcile(owner, {
      id: "analytics-with-consent",
      type: "order.paid",
      resourceId: "order",
    });
    expect(
      await db()
        .select()
        .from(analyticsOutbox)
        .where(eq(analyticsOutbox.userId, owner)),
    ).toHaveLength(1);
    vi.mocked(trackServer).mockRejectedValueOnce(
      new Error("Temporary ingestion failure"),
    );
    await expect(flushBillingAnalytics(owner)).rejects.toThrow("Temporary");
    expect(
      (
        await db()
          .select()
          .from(analyticsOutbox)
          .where(eq(analyticsOutbox.userId, owner))
      )[0].sentAt,
    ).toBeNull();
    await flushBillingAnalytics(owner);
    const calls = vi.mocked(trackServer).mock.calls;
    expect(calls[0][4]).toBe(calls[1][4]);
    expect(
      (
        await db()
          .select()
          .from(analyticsOutbox)
          .where(eq(analyticsOutbox.userId, owner))
      )[0].sentAt,
    ).not.toBeNull();
  },
);
