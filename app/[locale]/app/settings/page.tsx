import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/src/components/page-header";
import { ClientIntl } from "@/src/components/client-intl";
import { DeleteAccount, ProfileForm } from "@/src/components/settings-form";
import { AnalyticsPreferences } from "@/src/components/analytics-preferences";
import { PreferencesForm } from "@/src/features/preferences/preferences-form";
import { getPreferences } from "@/src/features/preferences/server";
import { techniqueLabels } from "@/src/features/techniques/content";
import { hasEntitlement } from "@/src/lib/billing/entitlements";
import { requireSession } from "@/src/lib/auth/session";
import { getEnv } from "@/src/config/env";
import { Link } from "@/src/i18n/navigation";
import {
  metadataLocale,
  resolveLocale,
  type LocaleParams,
} from "@/src/i18n/server";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("settings") };
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const { user } = await requireSession("/app/settings");
  const [prefs, labels, pro] = await Promise.all([
    getPreferences(user.id, locale),
    techniqueLabels(locale),
    hasEntitlement(user.id),
  ]);
  const t = await getTranslations("settings");
  return (
    <>
      <PageHeader title={t("title")} description={t("lead")} />
      <div className="stack">
        <section className="card stack">
          <h2 className="card-title">{t("account.title")}</h2>
          <p className="muted small" dir="auto">
            {user.email}
          </p>
          <ProfileForm name={user.name} />
          <div className="flex flex-wrap gap-4">
            <Link href="/app/settings/security" className="link small">
              {t("account.securityLink")}
            </Link>
            <Link href="/app/billing" className="link small">
              {t("account.billingLink")}
            </Link>
          </div>
        </section>
        <ClientIntl namespaces={["settings", "notifications", "focus"]}>
          <PreferencesForm
            locale={locale}
            pro={pro}
            labels={labels}
            vapidPublicKey={getEnv().VAPID_PUBLIC_KEY}
            initial={{
              timezone: prefs.timezone,
              weekStartsOn: prefs.weekStartsOn,
              weeklyFocusGoalMinutes: prefs.weeklyFocusGoalMinutes,
              defaultTimeTechnique: prefs.defaultTimeTechnique,
              defaultLearningMethod: prefs.defaultLearningMethod,
              techniqueSettings: prefs.techniqueSettings,
              customPresets: prefs.customPresets,
              reviewSteps: prefs.reviewSteps,
              dailyReminderTime: prefs.dailyReminderTime,
              emailReviews: prefs.emailReviews,
              emailWeekly: prefs.emailWeekly,
              streakNudge: prefs.streakNudge,
              workHours: prefs.workHours,
            }}
          />
        </ClientIntl>
        <section className="card stack">
          <h2 className="card-title">{t("analytics.title")}</h2>
          <p className="muted small">{t("analytics.text")}</p>
          <AnalyticsPreferences />
        </section>
        <section
          className="card stack"
          style={{ borderColor: "var(--danger-soft)" }}
        >
          <h2 className="card-title">{t("delete.title")}</h2>
          <p className="muted small">{t("delete.text")}</p>
          <DeleteAccount confirmWord={t("delete.word")} />
        </section>
      </div>
    </>
  );
}
