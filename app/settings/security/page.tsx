import { AppShell } from "@/src/components/app-shell";
import { SettingsForm, Sessions } from "@/src/components/settings-form";
export default function Page() {
  return (
    <AppShell title="Security">
      <h1>Keep your account yours.</h1>
      <p className="lead">A strong password. A little peace of mind.</p>
      <section className="panel">
        <h2>Change password</h2>
        <p>Changing your password also signs out your other sessions.</p>
        <SettingsForm security />
      </section>
      <section className="panel">
        <h2>Active sessions</h2>
        <p>Keep this session and sign out everywhere else.</p>
        <Sessions />
      </section>
    </AppShell>
  );
}
