import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { BillingButton } from "@/src/components/billing-button";
import { requireAppUser } from "@/src/lib/app-user";
import { getPlan, weeklyUsage } from "@/src/lib/billing/plan";
import { hasActiveSubscription } from "@/src/lib/billing/entitlements";
import { pendingDiscountCode } from "@/src/lib/growth/referrals";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";

export const metadata: Metadata = { title: "Plan" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const app = getAppConfig();
  if (!app.billingEnabled) notFound();
  const { user, profile } = await requireAppUser();
  const t = await getTranslations("billing");
  const { checkout } = await searchParams;
  const [plan, usage, subscribed, code] = await Promise.all([
    getPlan(user.id),
    weeklyUsage(user.id, profile.timezone),
    hasActiveSubscription(user.id),
    pendingDiscountCode(user.id),
  ]);
  return (
    <AppShell title={t("title")} narrow>
      <div className="page-title">
        <h1>{t("title")}</h1>
      </div>
      {checkout && <p className="notice">{t("returned")}</p>}
      <section className="card stack">
        <span className="overline">{t("current")}</span>
        <h2>{plan.plan === "plus" ? t("plus") : t("free")}</h2>
        <p className="muted">{t(`reason.${plan.reason}`)}</p>
        {plan.plan === "free" && (
          <p className="small">
            {t("usage", {
              used: Math.min(usage.used, usage.limit),
              limit: usage.limit,
            })}
          </p>
        )}
        <div className="row">
          {subscribed ? (
            <div style={{ minWidth: 260 }}>
              <BillingButton portal />
            </div>
          ) : (
            plan.plan === "free" && (
              <Link href="/pricing" className="button">
                {t("upgrade")}
              </Link>
            )
          )}
        </div>
      </section>
      {code && (
        <section className="card stack-sm">
          <h2>{t("rewardTitle")}</h2>
          <p className="muted">{t("rewardLead", { code })}</p>
        </section>
      )}
      <p className="small faint">{t("polarNote")}</p>
    </AppShell>
  );
}
