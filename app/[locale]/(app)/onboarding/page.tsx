// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { user as account } from "@/src/lib/db/schema";
import { getLocale, getTranslations } from "next-intl/server";
import { requireAppUser } from "@/src/lib/app-user";
import { getAppConfig } from "@/src/config/app";
import {
  initialOnboarding,
  onboardingDestination,
} from "@/src/lib/profiles/onboarding";
import { redirect } from "@/src/i18n/navigation";
import { Logo } from "@/src/components/logo";
import { AnalyticsIdentity } from "@/src/components/consent";
import styles from "./onboarding.module.css";
import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title"), robots: { index: false } };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { user, profile } = await requireAppUser(true);
  const { next } = await searchParams;
  if (profile.onboardedAt)
    redirect({ href: onboardingDestination(next), locale: await getLocale() });
  const app = getAppConfig();
  const [consent] = await db()
    .select({ analytics: account.analyticsConsent })
    .from(account)
    .where(eq(account.id, user.id));
  const initial = initialOnboarding(
    profile,
    profile.onboardingState,
    next,
    consent?.analytics ?? false,
  );
  return (
    <main className={styles.page}>
      <Logo name={app.name} logoUrl={app.logoUrl} href="/onboarding" />
      {app.analyticsEnabled && <AnalyticsIdentity id={user.id} />}
      <OnboardingForm
        initial={initial}
        appName={app.name}
        analyticsEnabled={app.analyticsEnabled}
        timezones={Intl.supportedValuesOf("timeZone")}
      />
    </main>
  );
}
