import Link from "next/link";
import {
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Sparkles,
  ArrowRight,
  Terminal,
} from "lucide-react";
import { AppShell } from "@/src/components/app-shell";
import { requireSession } from "@/src/lib/auth/session";
import { getCurrentPlan } from "@/src/lib/billing/entitlements";
export default async function Page() {
  const { user } = await requireSession();
  const plan = await getCurrentPlan(user.id);
  return (
    <AppShell title="Overview">
      <span className="overline">A LITTLE MOMENTUM GOES A LONG WAY</span>
      <h1>Welcome, {user.name.split(" ")[0]}.</h1>
      <p className="lead">
        A fresh start. A solid foundation. Let’s make it yours.
      </p>
      <div className="dashboard-cards">
        <article className="panel">
          <ShieldCheck />
          <span>Your account</span>
          <h2>Verified & ready</h2>
          <Link href="/settings">
            Manage account <ArrowUpRight size={16} />
          </Link>
        </article>
        <article className="panel">
          <CreditCard />
          <span>Current plan</span>
          <h2>{plan}</h2>
          <Link href="/billing">
            View billing <ArrowUpRight size={16} />
          </Link>
        </article>
        <article className="panel">
          <Sparkles />
          <span>Something to build on</span>
          <h2>Your first feature</h2>
          <Link href="/feature">
            Explore the sample <ArrowUpRight size={16} />
          </Link>
        </article>
      </div>
      <section className="panel welcome-panel">
        <div>
          <span className="overline">THE WORKSPACE IS YOURS</span>
          <h2>Small steps. Big possibilities.</h2>
          <p>
            Start with your profile, explore the sample feature, and make this
            space your own.
          </p>
          <Link href="/settings" className="button">
            Make yourself at home <ArrowRight size={16} />
          </Link>
        </div>
        <Terminal size={64} />
      </section>
    </AppShell>
  );
}
