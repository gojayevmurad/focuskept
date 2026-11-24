// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import styles from "./settings.module.css";
import { AvatarUpload } from "./avatar-upload";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { getPlan } from "@/src/lib/billing/plan";
import { getAppConfig } from "@/src/config/app";
import { db } from "@/src/lib/db";
import { account, user as userTable } from "@/src/lib/db/schema";
import {
  DeleteAccount,
  PasswordForm,
  PreferencesForm,
  ProfileForm,
} from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const { user, profile } = await requireAppUser();
  const t = await getTranslations("settings");
  const app = getAppConfig();
  const plus = (await getPlan(user.id)).plan === "plus";
  const [credential] = await db()
    .select({ id: account.id })
    .from(account)
    .where(
      and(eq(account.userId, user.id), eq(account.providerId, "credential")),
    );
  const [privacy] = await db()
    .select({ consent: userTable.analyticsConsent })
    .from(userTable)
    .where(eq(userTable.id, user.id));
  const preferences = {
    analyticsEnabled: app.analyticsEnabled,
    analyticsConsent: privacy?.consent ?? false,
    emailReminders: profile.emailReminders,
    pushReminders: profile.pushReminders,
    emailTips: profile.emailTips,
    emailMarketing: profile.emailMarketing,
    microphoneDefault: profile.microphoneDefault,
    matchSameSegment: profile.matchSameSegment,
    statsPublic: profile.statsPublic,
    plus,
    pushPublicKey: app.pushPublicKey,
    defaultDuration: profile.defaultDuration,
    preferredTimes: profile.preferredTimes,
    weeklyGoal: profile.weeklyGoal,
  };
  return (
    <AppShell title={t("title")}>
      <div className={styles.page}>
        <div className="page-title">
          <h1>{t("title")}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <div className={styles.layout}>
          <nav className={styles.nav} aria-label={t("title")}>
            {["profile", "focus", "notifications", "privacy", "account"].map(
              (section) => (
                <a key={section} href={`#${section}`}>
                  {t(`sections.${section}`)}
                </a>
              ),
            )}
          </nav>
          <div className={styles.sections}>
            <section id="profile" className="card stack">
              <h2>{t("profile")}</h2>
              <p className="muted">{t("profileLead")}</p>
              <AvatarUpload
                name={profile.displayName}
                url={profile.avatarUrl}
              />
              <ProfileForm
                displayName={profile.displayName}
                username={profile.username}
                bio={profile.bio}
                goal={profile.goal}
                timezone={profile.timezone}
                segments={profile.segments}
                timezones={Intl.supportedValuesOf("timeZone")}
              />
            </section>
            <section id="focus" className="card stack">
              <h2>{t("sections.focus")}</h2>
              <p className="muted">{t("focusLead")}</p>
              <PreferencesForm {...preferences} section="focus" />
            </section>
            <section id="notifications" className="card stack">
              <h2>{t("sections.notifications")}</h2>
              <p className="muted">{t("notificationsLead")}</p>
              <PreferencesForm {...preferences} section="notifications" />
            </section>
            <section id="privacy" className="card stack">
              <h2>{t("sections.privacy")}</h2>
              <p className="muted">{t("privacyLead")}</p>
              <PreferencesForm {...preferences} section="privacy" />
              <h3>{t("data")}</h3>
              <p className="muted small">{t("dataLead")}</p>
              <div className="row">
                <a
                  className="button secondary"
                  href="/api/account/export"
                  download
                >
                  <Download size={16} />
                  {t("export")}
                </a>
              </div>
            </section>
            <section id="account" className="card stack">
              <h2>{t("sections.account")}</h2>
              <p className="muted">{t("accountLead")}</p>
              {credential && (
                <section className="card stack">
                  <h2>{t("security")}</h2>
                  <PasswordForm />
                </section>
              )}
              <Link className="button secondary" href="/dashboard?tour=replay">
                {(await getTranslations("onboarding.welcomeFlow"))("replay")}
              </Link>
              <div className="stack">
                <h2>{t("deleteTitle")}</h2>
                <p className="muted small">{t("deleteLead")}</p>
                <DeleteAccount hasPassword={Boolean(credential)} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
