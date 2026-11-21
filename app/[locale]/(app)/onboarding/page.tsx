import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { requireAppUser } from "@/src/lib/app-user";
import { getAppConfig } from "@/src/config/app";
import { suggestedSlots } from "@/src/lib/bookings/availability";
import { redirect } from "@/src/i18n/navigation";
import { Logo } from "@/src/components/logo";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

export default async function Page() {
  const { user, profile } = await requireAppUser(true);
  if (profile.onboardedAt) redirect({ href: "/dashboard", locale: await getLocale() });
  const t = await getTranslations("onboarding");
  const app = getAppConfig();
  const slots = await suggestedSlots(user.id, 50);
  return (
    <main className="content content-narrow" style={{ paddingTop: 40 }}>
      <Logo name={app.name} logoUrl={app.logoUrl} href="/onboarding" />
      <h1>{t("title")}</h1>
      <OnboardingForm
        displayName={profile.displayName}
        username={profile.username}
        timezone={profile.timezone}
        appUrl={app.url}
        timezones={Intl.supportedValuesOf("timeZone")}
        slots={slots.map((s) => ({ startAt: s.startAt.toISOString(), waiting: s.waiting, popular: s.popular }))}
      />
    </main>
  );
}
