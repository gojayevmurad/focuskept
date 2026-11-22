// SPDX-License-Identifier: AGPL-3.0-only
import { db } from "@/src/lib/db";
import { billingCustomer } from "@/src/lib/db/schema";
import { z } from "zod";
import { getSession } from "@/src/lib/auth/session";
import { getEnv } from "@/src/config/env";
import { sameOrigin } from "@/src/lib/security/validation";
import { rateLimit } from "@/src/lib/security/rate-limit";
import { polar, products } from "@/src/lib/billing/provider";
import { pendingDiscountCode } from "@/src/lib/growth/referrals";
import { trackForUser } from "@/src/lib/analytics/product";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  const env = getEnv();
  if (!sameOrigin(request, env.APP_URL))
    return new Response(null, { status: 403 });
  const session = await getSession();
  if (!session?.user.emailVerified)
    return Response.json({ error: "Sign in first" }, { status: 401 });
  if (!env.BILLING_ENABLED || !env.POLAR_ACCESS_TOKEN)
    return Response.json(
      { error: "Billing is not configured. No payment has been taken." },
      { status: 503 },
    );
  if (!(await rateLimit(`billing:${session.user.id}`, 10, 60))) {
    return Response.json(
      { error: "Too many billing requests. Please wait a minute." },
      { status: 429 },
    );
  }
  try {
    const { action } = await ctx.params;
    if (action === "portal") {
      const portal = await polar().customerSessions.create({
        external_customer_id: session.user.id,
        return_url: env.APP_URL + "/billing",
      });
      return Response.json({ url: portal.customer_portal_url });
    }
    if (action !== "checkout") return new Response(null, { status: 404 });
    const body = z
      .object({ plan: z.enum(["monthly", "yearly", "lifetime"]) })
      .safeParse(await request.json());
    if (!body.success)
      return Response.json({ error: "Choose a valid plan" }, { status: 400 });
    const product = products()[body.data.plan];
    if (!product)
      return Response.json(
        { error: "This plan is not configured" },
        { status: 503 },
      );
    await db()
      .insert(billingCustomer)
      .values({ userId: session.user.id })
      .onConflictDoNothing();
    // A referral reward waiting for this person is applied automatically.
    const code = await pendingDiscountCode(session.user.id);
    let discountId: string | undefined;
    if (code) {
      const found = await polar().discounts.list({ query: code, limit: 1 });
      discountId = found.items.find((d) => d.code === code)?.id;
    }
    void trackForUser(session.user.id, "upgrade_started", {
      plan: body.data.plan,
    });
    const checkout = await polar().checkouts.create({
      products: [product],
      ...(discountId ? { discount_id: discountId } : {}),
      external_customer_id: session.user.id,
      customer_email: session.user.email,
      success_url: env.APP_URL + "/billing?checkout=returned",
      return_url: env.APP_URL + "/pricing",
    });
    return Response.json({ url: checkout.url });
  } catch {
    return Response.json(
      { error: "Billing service unavailable. Please try again." },
      { status: 503 },
    );
  }
}
