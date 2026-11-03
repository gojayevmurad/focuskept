import type { Metadata } from "next";
import { Link } from "@/src/i18n/navigation";
import { currentAppPath, requireSession } from "@/src/lib/auth/session";
import { Logo } from "@/src/components/logo";
import { AccountMenu } from "@/src/components/account-menu";
import { AnalyticsIdentity } from "@/src/components/consent";
import { AppNav } from "@/src/components/app-nav";
import { ClientIntl } from "@/src/components/client-intl";
import { PreferencesSync } from "@/src/features/preferences/preferences-sync";
import { ImportPrompt } from "@/src/features/import/import-prompt";
import { findPreferences } from "@/src/features/preferences/server";
import { countDue } from "@/src/features/reviews/server";
import { localDate } from "@/src/lib/dates";
import type { Locale } from "@/src/i18n/config";
import { resolveLocale } from "@/src/i18n/server";

// Signed-in pages are private: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const session = await requireSession(await currentAppPath());
  const prefs = await findPreferences(session.user.id);
  const dueCount = await countDue(
    session.user.id,
    localDate(prefs?.timezone ?? "UTC"),
  );
  return (
    <ClientIntl namespaces={["settings", "focus"]}>
      <div className="app-shell">
        <header className="app-header focus-fade">
          <Link href="/app" className="logo">
            <Logo />
          </Link>
          <AppNav dueCount={dueCount} variant="pills" />
          <div className="app-header-end">
            <AccountMenu name={session.user.name || session.user.email} />
          </div>
        </header>
        <main id="main" className="app-content">
          {children}
        </main>
        <div className="focus-fade">
          <AppNav dueCount={dueCount} variant="tabs" />
        </div>
        <AnalyticsIdentity id={session.user.id} />
        <ImportPrompt />
        <PreferencesSync
          initialized={Boolean(prefs)}
          savedLocale={(prefs?.locale as Locale | undefined) ?? locale}
        />
      </div>
    </ClientIntl>
  );
}
