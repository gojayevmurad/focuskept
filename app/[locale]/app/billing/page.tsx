import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/src/components/page-header";
import { BillingButton } from "@/src/components/billing-button";
import { ClientIntl } from "@/src/components/client-intl";
import { requireSession } from "@/src/lib/auth/session";
import { hasEntitlement } from "@/src/lib/billing/entitlements";
import { PRICES_USD } from "@/src/lib/billing/plans";
import { db } from "@/src/lib/db";
import { subscription } from "@/src/lib/db/schema";
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
  return { title: t("billing") };
}

export default async function Page({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<{ checkout?: string }> }) {
  await resolveLocale(params);
  const { user } = await requireSession("/app/billing");
  const pro = await hasEntitlement(user.id);
  const subs = await db()
    .select()
    .from(subscription)
    .where(eq(subscription.userId, user.id));
  const active = subs.find((s) => s.status === "active");
  const t = await getTranslations("billing");
  const tp = await getTranslations("pricing");
  const lang = await getLocale();
  const money = (amount: number) =>
    new Intl.NumberFormat(lang, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  const returned = (await searchParams).checkout === "returned";
  const configured = Boolean(getEnv().POLAR_ACCESS_TOKEN);
  return (
    <ClientIntl namespaces={["billing"]}>
      <PageHeader title={t("title")} description={t("lead")} />
      {returned && (
        <p className="notice mb-4" role="status">
          {t("returned")}
        </p>
      )}
      <div className="stack">
        <section className="card stack">
          <span className="eyebrow">{t("currentPlan")}</span>
          <h2 className="text-2xl">{pro ? t("pro") : t("free")}</h2>
          {active && (
            <p className="small muted">
              {t(active.cancelAtPeriodEnd ? "endsOn" : "renewsOn", {
                date: new Intl.DateTimeFormat(lang, {
                  dateStyle: "long",
                }).format(active.periodEnd),
              })}
            </p>
          )}
          <p className="muted small">{t("syncNote")}</p>
          {pro ? (
            <div style={{ maxWidth: 320 }}>
              <BillingButton portal label={t("manage")} variant="secondary" />
            </div>
          ) : (
            <div className="grid-2" style={{ maxWidth: 560 }}>
              <BillingButton
                plan="monthly"
                label={`${tp("monthly.name")} · ${money(PRICES_USD.monthly)}${tp("perMonth")}`}
              />
              <BillingButton
                plan="yearly"
                label={`${tp("yearly.name")} · ${money(PRICES_USD.yearly)}${tp("perYear")}`}
                variant="secondary"
              />
            </div>
          )}
          {!configured && <p className="hint">{t("notConfigured")}</p>}
          <Link href="/pricing" className="link small">
            {t("seePlans")}
          </Link>
        </section>
      </div>
    </ClientIntl>
  );
}
