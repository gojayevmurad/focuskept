// schema.org builders shared by public pages. Static, app-authored data only
// (never user content). Entities use stable @ids so pages link into one graph.
import { brand } from "@/src/config/brand";
import { locales, type Locale } from "@/src/i18n/config";
import { PRICES_USD } from "@/src/lib/billing/plans";
import { appUrl } from "./site";
import { pageUrl } from "./seo";

export const ORG_ID = () => `${appUrl()}/#organization`;
export const SITE_ID = () => `${appUrl()}/#website`;
export const APP_ID = () => `${appUrl()}/#app`;

export function organization() {
  return {
    "@type": "Organization",
    "@id": ORG_ID(),
    name: brand.name,
    url: appUrl(),
    logo: {
      "@type": "ImageObject",
      url: `${appUrl()}/icons/icon-512.png`,
      width: 512,
      height: 512,
    },
    email: brand.supportEmail,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: brand.supportEmail,
      availableLanguage: [...locales],
    },
  };
}

export function website(locale: Locale, description: string) {
  return {
    "@type": "WebSite",
    "@id": SITE_ID(),
    url: appUrl(),
    name: brand.name,
    description,
    inLanguage: locale,
    publisher: { "@id": ORG_ID() },
  };
}

/** The product itself, with the Free and Pro offers. */
export function application(
  locale: Locale,
  description: string,
  features: string[],
) {
  const offer = (name: string, price: number, period?: string) => ({
    "@type": "Offer",
    name,
    price: String(price),
    priceCurrency: "USD",
    url: pageUrl(locale, "/pricing"),
    ...(period
      ? {
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: String(price),
            priceCurrency: "USD",
            billingDuration: period,
            unitCode: period === "P1M" ? "MON" : "ANN",
          },
        }
      : {}),
  });
  return {
    "@type": ["WebApplication", "SoftwareApplication"],
    "@id": APP_ID(),
    name: brand.name,
    url: pageUrl(locale),
    description,
    inLanguage: locale,
    applicationCategory: "EducationalApplication",
    applicationSubCategory: "Focus timer and spaced repetition",
    operatingSystem: "Web, iOS, Android, Windows, macOS, Linux",
    browserRequirements: "Requires JavaScript and a modern browser.",
    isAccessibleForFree: true,
    featureList: features,
    image: `${pageUrl(locale)}/opengraph-image`,
    publisher: { "@id": ORG_ID() },
    offers: [
      offer("Free", 0),
      offer("Pro monthly", PRICES_USD.monthly, "P1M"),
      offer("Pro yearly", PRICES_USD.yearly, "P1Y"),
    ],
  };
}

export function webPage({
  locale,
  path,
  name,
  description,
  type = "WebPage",
}: {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  type?: "WebPage" | "AboutPage" | "CollectionPage" | "FAQPage";
}) {
  const url = pageUrl(locale, path);
  return {
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: locale,
    isPartOf: { "@id": SITE_ID() },
    publisher: { "@id": ORG_ID() },
  };
}

/** Home › … › current page. `items` are [name, locale-less path] pairs. */
export function breadcrumbs(locale: Locale, items: [string, string][]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [[brand.name, "/"] as [string, string], ...items].map(
      ([name, path], i) => ({
        "@type": "ListItem",
        position: i + 1,
        name,
        item: pageUrl(locale, path),
      }),
    ),
  };
}

export function faq(
  locale: Locale,
  path: string,
  qas: { q: string; a: string }[],
) {
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl(locale, path)}#faq`,
    inLanguage: locale,
    mainEntity: qas.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/** One JSON-LD document with an @graph. */
export function graph(...nodes: Record<string, unknown>[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}
