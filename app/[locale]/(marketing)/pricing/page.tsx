// SPDX-License-Identifier: AGPL-3.0-only
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { BillingButton } from "@/src/components/billing-button";
import { getPrices } from "@/src/lib/content/prices";
import {
  requireMarketing,
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
export async function generateMetadata({ params }: LocaleProps) {
  return translatedMetadata(params, "pricing", "/pricing");
}
export default async function Pricing({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  if (!getAppConfig().billingEnabled) notFound();
  const [t, home, prices] = await Promise.all([
    getTranslations("pricing"),
    getTranslations("home"),
    getPrices(),
  ]);
  return (
    <div className="container">
      <header className="page-head">
        <h1>{t("heading")}</h1>
        <p className="lead">{t("lead")}</p>
      </header>
      <section className="section pricing-grid">
        <article className="price-card card">
          <h2>{t("free")}</h2>
          <p className="price">{t("freePrice")}</p>
          <ul className="ticks">
            {(t.raw("freeFeatures") as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link href="/sign-up" className="button secondary">
            {home("start")}
          </Link>
        </article>
        <article className="price-card card featured">
          <h2>{t("plus")}</h2>
          <span className="badge accent">{t("trial")}</span>
          <ul className="ticks">
            {(t.raw("plusFeatures") as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {(["monthly", "yearly"] as const).map((plan) => (
            <section className="stack-sm" key={plan}>
              <h3>{t(plan)}</h3>
              <p>
                {prices?.[plan] ?? t("fallback")}{" "}
                <span className="small muted">
                  {t(plan === "monthly" ? "perMonth" : "perYear")}
                </span>
              </p>
              <BillingButton plan={plan} />
            </section>
          ))}
          <p className="small muted">{t("trialBody")}</p>
          <p className="small muted">{t("cancel")}</p>
        </article>
      </section>
    </div>
  );
}
