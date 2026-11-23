// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { Link, redirect } from "@/src/i18n/navigation";
import { BillingButton } from "@/src/components/billing-button";
import styles from "@/src/components/marketing/marketing.module.css";
import { getPrices } from "@/src/lib/content/prices";
import {
  absoluteUrl,
  localizedPath,
  requireMarketing,
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import { JsonLd } from "@/src/components/marketing/json-ld";
import {
  buildBreadcrumbSchema,
  buildGraph,
  buildWebApplicationSchema,
} from "@/src/lib/seo/schema";

export async function generateMetadata({ params }: LocaleProps) {
  return translatedMetadata(params, "pricing", "/pricing");
}

export default async function Pricing({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  // While billing is off everything is free: send old pricing links home (temporary).
  if (!getAppConfig().billingEnabled) redirect({ href: "/", locale });
  const [t, home, prices] = await Promise.all([
    getTranslations("pricing"),
    getTranslations("home"),
    getPrices(),
  ]);

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.pageHead}>
        <h1>{t("heading")}</h1>
        <p>{t("lead")}</p>
      </header>
      <section className={styles.plans}>
        <article className={styles.plan}>
          <h2>{t("free")}</h2>
          <p className={styles.planPrice}>{t("freePrice")}</p>
          <ul>
            {(t.raw("freeFeatures") as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link
            href="/sign-up"
            className={`button secondary ${styles.bookingButton}`}
          >
            {home("start")}
          </Link>
        </article>
        <article className={styles.plan}>
          <h2>{t("plus")}</h2>
          <span className={styles.trial}>{t("trial")}</span>
          <ul>
            {(t.raw("plusFeatures") as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className={styles.billingOptions}>
            {(["monthly", "yearly"] as const).map((plan) => (
              <section className={styles.billingOption} key={plan}>
                <h3>{t(plan)}</h3>
                <p>
                  {prices?.[plan] ?? t("fallback")}{" "}
                  <span className={styles.planNote}>
                    {t(plan === "monthly" ? "perMonth" : "perYear")}
                  </span>
                </p>
                <BillingButton plan={plan} />
              </section>
            ))}
          </div>
          <p className={styles.planNote}>{t("trialBody")}</p>
          <p className={styles.planNote}>{t("cancel")}</p>
        </article>
      </section>
      <JsonLd
        data={buildGraph([
          buildBreadcrumbSchema([
            { name: "Home", url: absoluteUrl(localizedPath("/", locale)) },
            {
              name: t("heading"),
              url: absoluteUrl(localizedPath("/pricing", locale)),
            },
          ]),
          buildWebApplicationSchema(getAppConfig(), prices),
        ])}
      />
    </div>
  );
}
