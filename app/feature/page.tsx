import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";
import { AppShell } from "@/src/components/app-shell";
import { requireSession } from "@/src/lib/auth/session";
import { hasEntitlement } from "@/src/lib/billing/entitlements";
export default async function Page() {
  const { user } = await requireSession();
  const allowed = await hasEntitlement(user.id);
  return (
    <AppShell title="Sample feature">
      <h1>A little extra possibility.</h1>
      <p className="lead">
        A simple example of access checked securely on the server.
      </p>
      <section className="panel empty-state">
        {allowed ? (
          <>
            <Sparkles size={36} />
            <h2>Your Pro workspace is open.</h2>
            <p>
              This premium content was authorized on the server. Replace it with
              your product’s first feature.
            </p>
          </>
        ) : (
          <>
            <LockKeyhole size={36} />
            <h2>A little more room to build.</h2>
            <p>This sample feature is part of Pro. Upgrade to unlock access.</p>
            <Link href="/pricing" className="button">
              Explore Pro
            </Link>
          </>
        )}
      </section>
    </AppShell>
  );
}
