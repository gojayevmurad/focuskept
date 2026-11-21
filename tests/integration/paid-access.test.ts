import { it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "@/app/api/webhooks/polar/route";
import { db } from "@/src/lib/db";
import { processedEvent } from "@/src/lib/db/schema";
import { eq } from "drizzle-orm";
vi.mock("@/src/lib/billing/provider", () => ({
  polar: () => ({
    customers: {
      getStateExternal: async (id: string) => ({
        id: "e2e-customer-" + id,
        external_id: id,
        granted_benefits: [{ benefit_id: "fixture-pro" }],
        active_subscriptions: [],
      }),
    },
  }),
}));
it.skipIf(!process.env.E2E_GRANT_USER_ID)(
  "grants paid browser access only through a validated fixture event",
  async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith("_test"))
      throw new Error("Isolated _test database required");
    vi.stubEnv("DATABASE_URL", url);
    vi.stubEnv("POLAR_PRO_BENEFIT_ID", "fixture-pro");
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "e2e-only-signing-key");
    const id = "e2e-paid-" + crypto.randomUUID();
    const stamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      type: "customer.state_changed",
      timestamp: new Date().toISOString(),
      data: { external_id: process.env.E2E_GRANT_USER_ID },
    });
    const sig = createHmac("sha256", "e2e-only-signing-key")
      .update(`${id}.${stamp}.${body}`)
      .digest("base64");
    try {
      const result = await POST(
        new Request("http://localhost/api/webhooks/polar", {
          method: "POST",
          body,
          headers: {
            "webhook-id": id,
            "webhook-timestamp": stamp,
            "webhook-signature": `v1,${sig}`,
          },
        }),
      );
      expect(result.status).toBe(200);
    } finally {
      await db().delete(processedEvent).where(eq(processedEvent.id, id));
      vi.unstubAllEnvs();
    }
  },
);
