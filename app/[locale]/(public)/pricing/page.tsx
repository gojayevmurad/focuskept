import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Check, Minus } from "lucide-react";
import { ClientIntl } from "@/src/components/client-intl";
import { BillingButton } from "@/src/components/billing-button";
import { Link } from "@/src/i18n/navigation";
import { PRICES_USD } from "@/src/lib/billing/plans";
import {
  metadataLocale,
  resolveLocale,
  type LocaleParams,
} from "@/src/i18n/server";
import { publicMetadata } from "@/src/lib/seo";
import { JsonLd } from "@/src/components/json-ld";
import {
  application,
  breadcrumbs,
  faq,
  graph,
  webPage,
} from "@/src/lib/structured-data";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return publicMetadata({
    locale,
    path: "/pricing",
    title: t("pricingTitle"),
    description: t("pricingDescription"),
  });
}

const ROWS = [
  "techniques",
  "tasks",
  "cards",
  "ai",
  "grading",
  "reminders",
  "lab",
  "weekly",
  "export",
] as const;
const PRO_ONLY = new Set(["weekly"]);
const FAQ = ["1", "2", "3", "4", "5"] as const;

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("pricing");
  const meta = await getTranslations("meta");
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  const monthlyEquivalent = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(PRICES_USD.yearly / 12);
  return (
    <div className="container" style={{ paddingBlock: "56px 24px" }}>
      <JsonLd
        data={graph(
          webPage({
            locale,
            path: "/pricing",
            name: meta("pricingTitle"),
            description: meta("pricingDescription"),
          }),
          breadcrumbs(locale, [[meta("pricingTitle"), "/pricing"]]),
          application(
            locale,
            meta("defaultDescription"),
            ROWS.map((row) => t(`rows.${row}.label`)),
          ),
          faq(
            locale,
            "/pricing",
            FAQ.map((n) => ({ q: t(`faq.${n}.q`), a: t(`faq.${n}.a`) })),
          ),
        )}
      />
      <div className="text-center mx-auto" style={{ maxWidth: 640 }}>
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="lead mt-3">{t("lead")}</p>
      </div>
      <ClientIntl namespaces={["billing"]}>
        <div className="grid-3 mt-10" style={{ alignItems: "stretch" }}>
          <article className="card stack">
            <h2 className="card-title">{t("free.name")}</h2>
            <p className="stat-value">{money(0)}</p>
            <p className="small muted">{t("free.text")}</p>
            <ul
              className="stack small"
              style={{ gap: 8, listStyle: "none", padding: 0, margin: 0 }}
            >
              {(["1", "2", "3", "4"] as const).map((n) => (
                <li key={n} className="flex gap-2">
                  <Check
                    size={16}
                    className="text-accent shrink-0"
                    aria-hidden="true"
                  />
                  {t(`free.points.${n}`)}
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <Link href="/focus" className="btn btn-secondary btn-block">
                {t("free.cta")}
              </Link>
            </div>
          </article>
          <article
            className="card stack card-accent"
            style={{ borderColor: "var(--accent)" }}
          >
            <h2 className="card-title">{t("monthly.name")}</h2>
            <p className="stat-value">
              {money(PRICES_USD.monthly)}{" "}
              <span className="small muted">{t("perMonth")}</span>
            </p>
            <p className="small muted">{t("monthly.text")}</p>
            <ul
              className="stack small"
              style={{ gap: 8, listStyle: "none", padding: 0, margin: 0 }}
            >
              {(["1", "2", "3", "4"] as const).map((n) => (
                <li key={n} className="flex gap-2">
                  <Check
                    size={16}
                    className="text-accent shrink-0"
                    aria-hidden="true"
                  />
                  {t(`pro.points.${n}`)}
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <BillingButton plan="monthly" label={t("monthly.cta")} />
            </div>
          </article>
          <article className="card stack">
            <div className="flex items-center justify-between gap-2">
              <h2 className="card-title">{t("yearly.name")}</h2>
              <span className="badge badge-accent">
                {t("yearly.badge", {
                  percent: Math.round(
                    (1 - PRICES_USD.yearly / (PRICES_USD.monthly * 12)) * 100,
                  ),
                })}
              </span>
            </div>
            <p className="stat-value">
              {money(PRICES_USD.yearly)}{" "}
              <span className="small muted">{t("perYear")}</span>
            </p>
            <p className="small muted">
              {t("yearly.text", { monthly: monthlyEquivalent })}
            </p>
            <ul
              className="stack small"
              style={{ gap: 8, listStyle: "none", padding: 0, margin: 0 }}
            >
              <li className="flex gap-2">
                <Check
                  size={16}
                  className="text-accent shrink-0"
                  aria-hidden="true"
                />
                {t("yearly.point")}
              </li>
            </ul>
            <div className="mt-auto">
              <BillingButton
                plan="yearly"
                label={t("yearly.cta")}
                variant="secondary"
              />
            </div>
          </article>
        </div>
      </ClientIntl>
      <p className="hint text-center mt-4">{t("checkoutNote")}</p>

      <section className="card mt-10" aria-labelledby="compare">
        <h2 id="compare" className="card-title mb-3">
          {t("compare")}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table compare-table">
            <colgroup>
              <col style={{ inlineSize: "40%" }} />
              <col style={{ inlineSize: "30%" }} />
              <col style={{ inlineSize: "30%" }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t("feature")}</th>
                <th scope="col">{t("free.name")}</th>
                <th scope="col">{t("pro.name")}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row}>
                  <th scope="row" style={{ fontWeight: 400 }}>
                    {t(`rows.${row}.label`)}
                  </th>
                  <td>
                    {PRO_ONLY.has(row) ? (
                      <Minus size={16} aria-label={t("notIncluded")} />
                    ) : (
                      t(`rows.${row}.free`)
                    )}
                  </td>
                  <td>{t(`rows.${row}.pro`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="container-narrow mt-10 stack"
        aria-labelledby="pricing-faq"
        style={{ paddingInline: 0 }}
      >
        <h2 id="pricing-faq" className="text-xl">
          {t("faqTitle")}
        </h2>
        {FAQ.map((n) => (
          <details key={n} className="card card-sm">
            <summary className="font-medium" style={{ cursor: "pointer" }}>
              {t(`faq.${n}.q`)}
            </summary>
            <p className="small muted mt-2">{t(`faq.${n}.a`)}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
