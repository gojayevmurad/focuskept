import { createHmac } from "node:crypto";
import { POST } from "@/app/api/webhooks/polar/route";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { reconcile } from "@/src/lib/billing/sync";
import { hasEntitlement } from "@/src/lib/billing/entitlements";
import { db } from "@/src/lib/db";
import { user, entitlement, processedEvent } from "@/src/lib/db/schema";
import { eq } from "drizzle-orm";
const provider = vi.hoisted(() => ({
  state: {
    id: "cus_test",
    external_id: "integration-user",
    granted_benefits: [{ benefit_id: "pro-benefit" }],
    active_subscriptions: [],
  },
}));
vi.mock("@/src/lib/billing/provider", () => ({
  polar: () => ({
    customers: { getStateExternal: vi.fn(async () => provider.state) },
  }),
}));
const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL must name a database ending in _test");
beforeAll(async () => {
  if (!url) return;
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("POLAR_PRO_BENEFIT_ID", "pro-benefit");
  vi.stubEnv("POLAR_WEBHOOK_SECRET", "fixture-signing-secret");
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  await db()
    .insert(user)
    .values({
      id: "integration-user",
      name: "Test",
      email: "integration@example.test",
      emailVerified: true,
    })
    .onConflictDoNothing();
});
afterAll(async () => {
  if (url) {
    await db()
      .delete(processedEvent)
      .where(eq(processedEvent.id, "integration-event"));
    await db().delete(user).where(eq(user.id, "integration-user"));
  }
  vi.unstubAllEnvs();
});
it.skipIf(!url)(
  "atomically synchronizes, deduplicates and reconciles delayed delivery",
  async () => {
    await reconcile("integration-user", {
      id: "integration-event",
      type: "customer.state_changed",
    });
    expect(await hasEntitlement("integration-user")).toBe(true);
    expect(
      await reconcile("integration-user", {
        id: "integration-event",
        type: "customer.state_changed",
      }),
    ).toBe("duplicate");
    provider.state.granted_benefits = [];
    await reconcile("integration-user");
    expect(await hasEntitlement("integration-user")).toBe(false);
    const [row] = await db()
      .select()
      .from(entitlement)
      .where(eq(entitlement.userId, "integration-user"));
    expect(row.pro).toBe(false);
  },
);

function delivery(id: string, externalId = "integration-user") {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: "customer.state_changed",
    timestamp: new Date().toISOString(),
    data: { external_id: externalId },
  });
  const signature = createHmac("sha256", "fixture-signing-secret")
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return new Request("http://localhost/api/webhooks/polar", {
    method: "POST",
    body,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
    },
  });
}
it.skipIf(!url)(
  "accepts signed events, deduplicates and ignores stale payload grants",
  async () => {
    provider.state.granted_benefits = [{ benefit_id: "pro-benefit" }];
    const id = "integration-signed";
    try {
      expect((await POST(delivery(id))).status).toBe(200);
      expect(await hasEntitlement("integration-user")).toBe(true);
      expect((await POST(delivery(id))).status).toBe(200);
      provider.state.granted_benefits = [];
      expect((await POST(delivery(id + "-old"))).status).toBe(200);
      expect(await hasEntitlement("integration-user")).toBe(false);
    } finally {
      await db().delete(processedEvent).where(eq(processedEvent.id, id));
      await db()
        .delete(processedEvent)
        .where(eq(processedEvent.id, id + "-old"));
    }
  },
);
it.skipIf(!url)(
  "rolls back customer mismatches and does not mark failed events complete",
  async () => {
    provider.state.external_id = "other-user";
    try {
      await expect(
        reconcile("integration-user", {
          id: "integration-failed",
          type: "customer.state_changed",
        }),
      ).rejects.toThrow("mismatch");
      expect(
        await db()
          .select()
          .from(processedEvent)
          .where(eq(processedEvent.id, "integration-failed")),
      ).toHaveLength(0);
    } finally {
      provider.state.external_id = "integration-user";
    }
  },
);
