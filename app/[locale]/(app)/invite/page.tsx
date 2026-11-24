// SPDX-License-Identifier: AGPL-3.0-only
import lanes from "@/app/[locale]/(app)/lanes.module.css";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { getAppConfig } from "@/src/config/app";
import {
  buildReferralLink,
  getReferralStats,
} from "@/src/lib/growth/referrals";
import { InviteShare } from "./invite-share";
import styles from "./invite.module.css";

export async function generateMetadata() {
  return { title: (await getTranslations("invite"))("title") };
}

export default async function Page() {
  const { user, profile: me } = await requireAppUser();
  const t = await getTranslations("invite");
  const app = getAppConfig();
  const { totalInvited, totalConverted, totalRewarded, referrals } =
    await getReferralStats(user.id);

  return (
    <AppShell title={t("title")} narrow>
      <div className={lanes.page}>
        <div className="page-title">
          <h1>{t("title")}</h1>
          <p className="muted">
            {app.billingEnabled ? t("leadReward") : t("lead")}
          </p>
        </div>

        <ol className={styles.steps}>
          {["share", "signup", app.billingEnabled ? "reward" : "together"].map(
            (step) => (
              <li key={step}>
                <strong>{t(`steps.${step}.title`)}</strong>
                <p className="small muted">{t(`steps.${step}.body`)}</p>
              </li>
            ),
          )}
        </ol>

        {app.billingEnabled && (
          <section className={styles.rewardCard}>
            <h2 className={styles.rewardHeadline}>{t("rewardHeadline")}</h2>
            <p className={styles.rewardBody}>{t("rewardBody")}</p>
          </section>
        )}

        <section className="card stack">
          <h2>{t("sharePrompt")}</h2>
          <InviteShare
            url={buildReferralLink(app.url, me.referralCode, "copy_link")}
            appName={app.name}
          />
          <p className="small faint">
            {app.billingEnabled ? t("how") : t("howFree")}
          </p>
        </section>

        <section className="card stack">
          <h2>{t("invited", { count: totalInvited })}</h2>

          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{totalInvited}</span>
              <span className={styles.statLabel}>{t("statsInvited")}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{totalConverted}</span>
              <span className={styles.statLabel}>{t("statsConverted")}</span>
            </div>
            <ol className={styles.steps}>
              {[
                "share",
                "signup",
                app.billingEnabled ? "reward" : "together",
              ].map((step) => (
                <li key={step}>
                  <strong>{t(`steps.${step}.title`)}</strong>
                  <p className="small muted">{t(`steps.${step}.body`)}</p>
                </li>
              ))}
            </ol>

            {app.billingEnabled && (
              <div className={styles.statItem}>
                <span className={styles.statNumber}>{totalRewarded}</span>
                <span className={styles.statLabel}>{t("statsRewarded")}</span>
              </div>
            )}
          </div>

          {referrals.length ? (
            <div className="list">
              {referrals.map((r, i) => (
                <div className="list-item" key={i}>
                  <span className="grow">{r.name}</span>
                  <span
                    className={`badge ${r.status === "pending" ? "" : "ok"}`}
                  >
                    {t(`status.${r.status}`)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">{t("none")}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
