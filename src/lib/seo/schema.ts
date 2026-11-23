// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { brandFiles } from "@/src/config/brand-assets";

export type SchemaOrgThing = Record<string, unknown>;

export function buildOrganizationSchema(
  app: { name: string; url: string; logoUrl?: string; supportEmail?: string },
  socialProfiles: string[] = [],
): SchemaOrgThing {
  const orgUrl = new URL("/", app.url).toString();
  // LOGO_URL wins; otherwise the kit's opaque 512px PNG tile (search engines
  // handle raster logos more consistently than SVG).
  const logoUrl = new URL(app.logoUrl || brandFiles.pwa.any512, app.url).toString();

  const sameAs = Array.from(
    new Set(
      [
        ...socialProfiles,
        "https://github.com/gojayevmurad/focuskept",
      ].filter(Boolean),
    ),
  );

  return {
    "@type": "Organization",
    "@id": new URL("/#organization", app.url).toString(),
    name: app.name,
    url: orgUrl,
    logo: logoUrl,
    ...(app.supportEmail ? { email: app.supportEmail } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function buildWebSiteSchema(app: {
  name: string;
  url: string;
}): SchemaOrgThing {
  return {
    "@type": "WebSite",
    "@id": new URL("/#website", app.url).toString(),
    name: app.name,
    url: new URL("/", app.url).toString(),
    publisher: {
      "@id": new URL("/#organization", app.url).toString(),
    },
    inLanguage: ["en", "de", "fr", "nl", "es"],
  };
}

export function buildWebApplicationSchema(
  app: {
    name: string;
    url: string;
    description?: string;
    billingEnabled?: boolean;
  },
  prices?: { monthly?: string; yearly?: string } | null,
): SchemaOrgThing {
  const appSchema: SchemaOrgThing = {
    "@type": "WebApplication",
    "@id": new URL("/#application", app.url).toString(),
    name: app.name,
    url: new URL("/", app.url).toString(),
    applicationCategory: "BusinessApplication",
    operatingSystem: "All",
    browserRequirements: "Requires WebRTC and JavaScript enabled",
    ...(app.description ? { description: app.description } : {}),
  };

  if (app.billingEnabled && prices && (prices.monthly || prices.yearly)) {
    const offers: Array<SchemaOrgThing> = [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
        description: "3 sessions per week, partner matching, streaks",
      },
    ];

    if (prices.monthly) {
      const amountMatch = prices.monthly.replace(/[^0-9.]/g, "");
      offers.push({
        "@type": "Offer",
        name: "Plus Monthly",
        price: amountMatch || prices.monthly,
        priceCurrency: "USD",
        description:
          "Unlimited sessions, favorite partners, advanced matching filters",
      });
    }

    if (prices.yearly) {
      const amountMatch = prices.yearly.replace(/[^0-9.]/g, "");
      offers.push({
        "@type": "Offer",
        name: "Plus Yearly",
        price: amountMatch || prices.yearly,
        priceCurrency: "USD",
        description:
          "Unlimited sessions, billed annually with a 7-day free trial",
      });
    }

    appSchema.offers = offers;
  }

  return appSchema;
}

export function buildFaqSchema(
  items: { q: string; a: string }[],
): SchemaOrgThing | null {
  if (!items || items.length === 0) return null;
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function buildHowToSchema(
  name: string,
  description: string,
  stages: { title: string; body: string }[],
): SchemaOrgThing | null {
  if (!stages || stages.length === 0) return null;
  return {
    "@type": "HowTo",
    name,
    description,
    step: stages.map((stage, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: stage.title,
      text: stage.body,
    })),
  };
}

export function buildBreadcrumbSchema(
  items: { name: string; url: string }[],
): SchemaOrgThing | null {
  if (!items || items.length === 0) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildBlogPostingSchema(
  post: {
    title: string;
    description: string;
    date: string;
    author: string;
    slug: string;
  },
  app: { name: string; url: string },
): SchemaOrgThing {
  const postUrl = new URL(`/blog/${post.slug}`, app.url).toString();
  return {
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: "en",
    mainEntityOfPage: postUrl,
    author: {
      "@type": "Person",
      name: post.author,
    },
    publisher: {
      "@id": new URL("/#organization", app.url).toString(),
    },
    image: new URL("/opengraph-image", app.url).toString(),
  };
}

export function buildProfilePageSchema(
  person: {
    username: string;
    displayName: string;
    bio?: string;
    statsPublic?: boolean;
  },
  app: { name: string; url: string },
): SchemaOrgThing | null {
  if (!person.statsPublic) return null;
  const profileUrl = new URL(`/u/${person.username}`, app.url).toString();
  return {
    "@type": "ProfilePage",
    "@id": profileUrl,
    url: profileUrl,
    name: `${person.displayName} (@${person.username})`,
    mainEntity: {
      "@type": "Person",
      name: person.displayName,
      identifier: person.username,
      url: profileUrl,
      ...(person.bio ? { description: person.bio } : {}),
    },
  };
}

export function buildGraph(nodes: (SchemaOrgThing | null | undefined)[]) {
  const validNodes = nodes.filter(
    (node): node is SchemaOrgThing => Boolean(node) && typeof node === "object",
  );
  return {
    "@context": "https://schema.org",
    "@graph": validNodes,
  };
}
