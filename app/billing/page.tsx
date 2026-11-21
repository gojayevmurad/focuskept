import Link from "next/link";
import { AppShell } from "@/src/components/app-shell";
import { BillingButton } from "@/src/components/billing-button";
import { requireSession } from "@/src/lib/auth/session";
import { getCurrentPlan } from "@/src/lib/billing/entitlements";
export default async function Page() {
  const { user } = await requireSession();
  const plan = await getCurrentPlan(user.id);
  return (
    <AppShell title="Billing">
      <h1>A plan that grows with you.</h1>
      <p className="lead">
        Manage your subscription, invoices, and payment details.
      </p>
      <section className="panel">
        <span className="overline">YOUR CURRENT PLAN</span>
        <h2>{plan}</h2>
        <p>
          Access is synchronized from Polar. Returning from checkout does not
          confirm payment. Updates may take a moment.
        </p>
        <div className="inline-actions">
          <Link href="/pricing" className="button secondary">
            Explore plans
          </Link>
          <BillingButton portal />
        </div>
      </section>
    </AppShell>
  );
}
