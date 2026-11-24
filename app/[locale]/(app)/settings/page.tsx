// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import styles from "@/app/[locale]/(app)/lanes.module.css";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { getPlan } from "@/src/lib/billing/plan";
import { getAppConfig } from "@/src/config/app";
import { db } from "@/src/lib/db";
import { account } from "@/src/lib/db/schema";
import {
  AnalyticsChoice,
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
  return (
    <AppShell title={t("title")} narrow>
      <div className={styles.page}>
        <div className="page-title">
          <h1>{t("title")}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <section className="card stack">
          <h2>{t("profile")}</h2>
          <ProfileForm
            displayName={profile.displayName}
            username={profile.username}
            bio={profile.bio}
            goal={profile.goal}
            timezone={profile.timezone}
            avatarUrl={profile.avatarUrl ?? ""}
            segments={profile.segments}
            timezones={Intl.supportedValuesOf("timeZone")}
          />
        </section>
        <section className="card stack">
          <h2>{t("preferences")}</h2>
          <PreferencesForm
            emailReminders={profile.emailReminders}
            pushReminders={profile.pushReminders}
            emailTips={profile.emailTips}
            microphoneDefault={profile.microphoneDefault}
            matchSameSegment={profile.matchSameSegment}
            statsPublic={profile.statsPublic}
            plus={plus}
            pushPublicKey={app.pushPublicKey}
          />
        </section>
        {credential && (
          <section className="card stack">
            <h2>{t("security")}</h2>
            <PasswordForm />
          </section>
        )}
        {app.analyticsEnabled && (
          <section className="card stack">
            <h2>{t("analytics")}</h2>
            <p className="muted small">{t("analyticsLead")}</p>
            <AnalyticsChoice />
          </section>
        )}
        <section className="card stack">
          <h2>{t("data")}</h2>
          <p className="muted small">{t("dataLead")}</p>
          <div className="row">
            <a className="button secondary" href="/api/account/export" download>
              <Download size={16} /> {t("export")}
            </a>
          </div>
        </section>
        <Link className="button secondary" href="/dashboard?tour=replay">
          {(await getTranslations("onboarding.welcomeFlow"))("replay")}
        </Link>
        <section className="card danger stack">
          <h2>{t("deleteTitle")}</h2>
          <p className="muted small">{t("deleteLead")}</p>
          <DeleteAccount hasPassword={Boolean(credential)} />
        </section>
      </div>
    </AppShell>
  );
}
