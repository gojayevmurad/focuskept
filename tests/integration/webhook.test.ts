import { it, expect, vi } from "vitest";
import { POST } from "@/app/api/webhooks/polar/route";
it("rejects an unsigned webhook before database access", async () => {
  vi.stubEnv("POLAR_WEBHOOK_SECRET", "whsec_test-secret");
  const response = await POST(
    new Request("http://localhost/api/webhooks/polar", {
      method: "POST",
      body: JSON.stringify({
        type: "customer.state_changed",
        data: { external_id: "victim" },
      }),
    }),
  );
  expect(response.status).toBe(403);
  vi.unstubAllEnvs();
});
it("disabled billing never accepts payment events", async () => {
  vi.stubEnv("POLAR_WEBHOOK_SECRET", "");
  const response = await POST(
    new Request("http://localhost/api/webhooks/polar", {
      method: "POST",
      body: "{}",
    }),
  );
  expect(response.status).toBe(503);
  vi.unstubAllEnvs();
});
