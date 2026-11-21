// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { db } from "@/src/lib/db";
import { profile, referral } from "@/src/lib/db/schema";
import { getAppConfig } from "@/src/config/app";
import { CopyLink } from "@/src/components/copy-link";

export const metadata: Metadata = { title: "Invite friends" };

export default async function Page() {
  const { user, profile: me } = await requireAppUser();
  const t = await getTranslations("invite");
  const app = getAppConfig();
  const rows = await db()
    .select({
      name: profile.displayName,
      status: referral.status,
      createdAt: referral.createdAt,
    })
    .from(referral)
    .innerJoin(profile, eq(profile.userId, referral.refereeId))
    .where(eq(referral.referrerId, user.id));
  const link = `${app.url}/r/${me.referralCode}`;
  return (
    <AppShell title={t("title")} narrow>
      <div className="page-title">
        <h1>{t("title")}</h1>
        <p className="muted">
          {app.billingEnabled ? t("leadReward") : t("lead")}
        </p>
      </div>
      <section className="card stack">
        <h2>{t("yourLink")}</h2>
        <CopyLink value={link} event="referral_sent" />
        <p className="small faint">{t("how")}</p>
      </section>
      <section className="card stack">
        <h2>{t("invited", { count: rows.length })}</h2>
        {rows.length ? (
          <div className="list">
            {rows.map((r, i) => (
              <div className="list-item" key={i}>
                <span className="grow">{r.name}</span>
                <span className={`badge ${r.status === "pending" ? "" : "ok"}`}>
                  {t(`status.${r.status}`)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">{t("none")}</p>
        )}
      </section>
    </AppShell>
  );
}
