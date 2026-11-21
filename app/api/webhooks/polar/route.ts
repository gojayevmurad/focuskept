import { withRequestLogging } from "@/src/lib/security/request";
import { webhooks } from "@polar-sh/sdk/2026-10";
import { getEnv } from "@/src/config/env";
import { reconcile } from "@/src/lib/billing/sync";
import { flushBillingAnalytics } from "@/src/lib/analytics/outbox";
import { logger } from "@/src/lib/logger";
export const runtime = "nodejs";
async function handle(request: Request) {
  const secret = getEnv().POLAR_WEBHOOK_SECRET;
  if (!secret)
    return Response.json({ error: "Billing disabled" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 1048576) return new Response(null, { status: 413 });
  let event;
  try {
    event = await webhooks.validateEvent(
      raw,
      Object.fromEntries(request.headers),
      secret,
    );
  } catch {
    return Response.json({ error: "Invalid webhook" }, { status: 403 });
  }
  const id = request.headers.get("webhook-id");
  if (!id) return new Response(null, { status: 400 });
  let userId: string | null | undefined;
  let resourceId: string | undefined;
  if (event.type === "customer.state_changed") userId = event.data.external_id;
  else if (
    event.type === "order.paid" ||
    event.type === "subscription.active" ||
    event.type === "subscription.canceled"
  ) {
    userId = event.data.customer.external_id;
    resourceId = event.data.id;
  } else return Response.json({ received: true, ignored: true });
  if (!userId) return Response.json({ received: true, ignored: true });
  try {
    await reconcile(userId, { id, type: event.type, resourceId });
    await flushBillingAnalytics(userId);
    return Response.json({ received: true });
  } catch {
    logger.error(
      { eventId: id, requestId: crypto.randomUUID() },
      "Billing reconciliation failed; retry required",
    );
    return Response.json({ error: "Retry later" }, { status: 503 });
  }
}

export const POST = withRequestLogging(handle, "polar-webhook");
