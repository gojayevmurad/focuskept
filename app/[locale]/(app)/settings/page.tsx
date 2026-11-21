import { AnalyticsPreferences } from "@/src/components/analytics-preferences";
import { AppShell } from "@/src/components/app-shell";
import { SettingsForm, DeleteAccount } from "@/src/components/settings-form";
import { requireSession } from "@/src/lib/auth/session";
export default async function Page() {
  const { user } = await requireSession();
  return (
    <AppShell title="Account">
      <h1>A space that feels like you.</h1>
      <p className="lead">Manage your profile and account preferences.</p>
      <section className="panel">
        <h2>Profile</h2>
        <p className="muted">{user.email} · Verified email</p>
        <SettingsForm name={user.name} />
      </section>
      <section className="panel">
        <h2>Analytics preferences</h2>
        <p>You control optional product analytics.</p>
        <AnalyticsPreferences />
      </section>
      <section className="panel danger-panel">
        <h2>Delete account</h2>
        <p>
          This permanently deletes your profile and sessions. Accounts connected
          to billing require a support review to prevent orphaned subscriptions.
          Google-only accounts should contact support.
        </p>
        <DeleteAccount />
      </section>
    </AppShell>
  );
}
