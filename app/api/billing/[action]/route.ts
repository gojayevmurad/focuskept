import { db } from "@/src/lib/db";
import { billingCustomer } from "@/src/lib/db/schema";
import { z } from "zod";
import { getSession } from "@/src/lib/auth/session";
import { getEnv } from "@/src/config/env";
import { sameOrigin } from "@/src/lib/security/validation";
import { polar, products } from "@/src/lib/billing/provider";
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
  if (!env.POLAR_ACCESS_TOKEN)
    return Response.json(
      { error: "Billing is not configured. No payment has been taken." },
      { status: 503 },
    );
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
    const checkout = await polar().checkouts.create({
      products: [product],
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
