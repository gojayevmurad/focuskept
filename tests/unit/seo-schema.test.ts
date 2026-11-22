// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  buildBlogPostingSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildGraph,
  buildHowToSchema,
  buildOrganizationSchema,
  buildProfilePageSchema,
  buildWebApplicationSchema,
  buildWebSiteSchema,
} from "@/src/lib/seo/schema";

describe("SEO Structured Data (Schema.org)", () => {
  const app = {
    name: "FocusKept",
    url: "https://focuskept.com",
    description: "Virtual coworking and body doubling",
    supportEmail: "support@focuskept.com",
  };

  it("builds valid Organization schema with logo and sameAs", () => {
    const org = buildOrganizationSchema(app, [
      "https://twitter.com/focuskept",
    ]);
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe("FocusKept");
    expect(org.url).toBe("https://focuskept.com/");
    expect(org.logo).toBe("https://focuskept.com/icon.svg");
    expect(org.email).toBe("support@focuskept.com");
    expect(org.sameAs).toEqual([
      "https://twitter.com/focuskept",
      "https://github.com/gojayevmurad/focuskept",
    ]);
  });

  it("builds valid WebSite schema with inLanguage and publisher", () => {
    const site = buildWebSiteSchema(app);
    expect(site["@type"]).toBe("WebSite");
    expect(site.name).toBe("FocusKept");
    expect(site.url).toBe("https://focuskept.com/");
    expect(site.publisher).toEqual({
      "@id": "https://focuskept.com/#organization",
    });
    expect(site.inLanguage).toContain("en");
    expect(site.inLanguage).toContain("de");
  });

  it("builds WebApplication schema without offers when billing is off", () => {
    const webApp = buildWebApplicationSchema({ ...app, billingEnabled: false });
    expect(webApp["@type"]).toBe("WebApplication");
    expect(webApp.name).toBe("FocusKept");
    expect(webApp.offers).toBeUndefined();
  });

  it("builds WebApplication schema without offers when prices are unknown", () => {
    const webApp = buildWebApplicationSchema(
      { ...app, billingEnabled: true },
      null,
    );
    expect(webApp["@type"]).toBe("WebApplication");
    expect(webApp.offers).toBeUndefined();
  });

  it("builds WebApplication schema with exact offers when billing is on and prices are known", () => {
    const webApp = buildWebApplicationSchema(
      { ...app, billingEnabled: true },
      { monthly: "$9.99", yearly: "$99.00" },
    );
    expect(webApp["@type"]).toBe("WebApplication");
    expect(Array.isArray(webApp.offers)).toBe(true);
    const offers = webApp.offers as Array<Record<string, unknown>>;
    expect(offers.length).toBe(3);
    expect(offers[0].name).toBe("Free");
    expect(offers[0].price).toBe("0");
    expect(offers[1].name).toBe("Plus Monthly");
    expect(offers[1].price).toBe("9.99");
    expect(offers[2].name).toBe("Plus Yearly");
    expect(offers[2].price).toBe("99.00");
  });

  it("builds FAQPage schema from Q&A list", () => {
    const faq = buildFaqSchema([
      { q: "What is body doubling?", a: "Working quietly alongside a partner." },
    ]);
    expect(faq?.["@type"]).toBe("FAQPage");
    const entities = faq?.mainEntity as Array<Record<string, unknown>>;
    expect(entities.length).toBe(1);
    expect(entities[0]["@type"]).toBe("Question");
    expect(entities[0].name).toBe("What is body doubling?");
    expect(entities[0].acceptedAnswer).toEqual({
      "@type": "Answer",
      text: "Working quietly alongside a partner.",
    });
  });

  it("returns null for empty FAQ list", () => {
    expect(buildFaqSchema([])).toBeNull();
  });

  it("builds HowTo schema with steps", () => {
    const howTo = buildHowToSchema("How a focus session works", "Simple steps", [
      { title: "Intro", body: "Say hello and state your goal." },
      { title: "Focus", body: "Work quietly with mics muted." },
    ]);
    expect(howTo?.["@type"]).toBe("HowTo");
    expect(howTo?.name).toBe("How a focus session works");
    const steps = howTo?.step as Array<Record<string, unknown>>;
    expect(steps.length).toBe(2);
    expect(steps[0]["@type"]).toBe("HowToStep");
    expect(steps[0].position).toBe(1);
    expect(steps[0].name).toBe("Intro");
    expect(steps[0].text).toBe("Say hello and state your goal.");
  });

  it("builds BreadcrumbList schema with 1-based positions", () => {
    const breadcrumb = buildBreadcrumbSchema([
      { name: "Home", url: "https://focuskept.com" },
      { name: "Blog", url: "https://focuskept.com/blog" },
      { name: "First Post", url: "https://focuskept.com/blog/first-post" },
    ]);
    expect(breadcrumb?.["@type"]).toBe("BreadcrumbList");
    const elements = breadcrumb?.itemListElement as Array<
      Record<string, unknown>
    >;
    expect(elements.length).toBe(3);
    expect(elements[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://focuskept.com",
    });
    expect(elements[2]).toEqual({
      "@type": "ListItem",
      position: 3,
      name: "First Post",
      item: "https://focuskept.com/blog/first-post",
    });
  });

  it("builds BlogPosting schema with author, datePublished, dateModified, and image", () => {
    const post = {
      title: "Body Doubling for Focus",
      description: "How to stay accountable on video.",
      date: "2026-11-20",
      author: "Murad Gojayev",
      slug: "body-doubling-focus",
    };
    const blogPosting = buildBlogPostingSchema(post, app);
    expect(blogPosting["@type"]).toBe("BlogPosting");
    expect(blogPosting.headline).toBe(post.title);
    expect(blogPosting.description).toBe(post.description);
    expect(blogPosting.datePublished).toBe("2026-11-20");
    expect(blogPosting.dateModified).toBe("2026-11-20");
    expect(blogPosting.inLanguage).toBe("en");
    expect(blogPosting.mainEntityOfPage).toBe(
      "https://focuskept.com/blog/body-doubling-focus",
    );
    expect(blogPosting.author).toEqual({
      "@type": "Person",
      name: "Murad Gojayev",
    });
    expect(blogPosting.publisher).toEqual({
      "@id": "https://focuskept.com/#organization",
    });
    expect(blogPosting.image).toBe("https://focuskept.com/opengraph-image");
  });

  it("builds ProfilePage only when profile is public", () => {
    const privatePerson = {
      username: "alex",
      displayName: "Alex Morgan",
      statsPublic: false,
    };
    expect(buildProfilePageSchema(privatePerson, app)).toBeNull();

    const publicPerson = {
      username: "sam",
      displayName: "Sam Taylor",
      bio: "Software developer and writer",
      statsPublic: true,
    };
    const profile = buildProfilePageSchema(publicPerson, app);
    expect(profile).not.toBeNull();
    expect(profile?.["@type"]).toBe("ProfilePage");
    expect(profile?.url).toBe("https://focuskept.com/u/sam");
    const entity = profile?.mainEntity as Record<string, unknown>;
    expect(entity["@type"]).toBe("Person");
    expect(entity.name).toBe("Sam Taylor");
    expect(entity.identifier).toBe("sam");
    expect(entity.description).toBe("Software developer and writer");
  });

  it("combines multiple schemas into one @graph", () => {
    const org = buildOrganizationSchema(app);
    const site = buildWebSiteSchema(app);
    const graph = buildGraph([org, site, null, undefined]);
    expect(graph["@context"]).toBe("https://schema.org");
    expect(Array.isArray(graph["@graph"])).toBe(true);
    expect(graph["@graph"].length).toBe(2);
    expect(graph["@graph"][0]["@type"]).toBe("Organization");
    expect(graph["@graph"][1]["@type"]).toBe("WebSite");
  });
});
