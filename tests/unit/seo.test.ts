import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { locales } from "@/src/i18n/config";
import { ALL_TECHNIQUES, publicSlug } from "@/src/features/techniques/slugs";
import { llmsFullTxt, llmsTxt } from "@/src/lib/llms";
import { localizedAlternates, publicMetadata } from "@/src/lib/seo";
import { breadcrumbs, faq } from "@/src/lib/structured-data";

describe("page metadata", () => {
  it("gives every public page a canonical URL and all hreflang alternates", () => {
    const alternates = localizedAlternates("az", "/pricing");
    const languages = alternates?.languages as Record<string, string>;
    expect(alternates?.canonical).toMatch(/\/az\/pricing$/);
    expect(Object.keys(languages)).toHaveLength(locales.length + 1);
    expect(languages["x-default"]).toMatch(/\/en\/pricing$/);
  });

  it("adds Open Graph locale, URL and a large card image", () => {
    const m = publicMetadata({
      locale: "de",
      path: "/focus",
      title: "Fokus",
      description: "Text",
    });
    expect(m.openGraph).toMatchObject({
      locale: "de_DE",
      url: expect.stringMatching(/\/de\/focus$/),
      title: "Fokus · FocusKept",
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });
});

describe("structured data", () => {
  it("numbers breadcrumbs from the home page", () => {
    const list = breadcrumbs("en", [["Pricing", "/pricing"]]);
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(list.itemListElement[1].item).toMatch(/\/en\/pricing$/);
  });

  it("maps questions to FAQPage entities", () => {
    const page = faq("en", "/", [{ q: "Q?", a: "A." }]);
    expect(page.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Q?",
      acceptedAnswer: { text: "A." },
    });
  });
});

describe("GEO", () => {
  it("lists every technique guide in llms.txt and its full text in llms-full.txt", () => {
    const index = llmsTxt();
    const full = llmsFullTxt();
    for (const slug of ALL_TECHNIQUES) {
      expect(index).toContain(`/en/techniques/${publicSlug(slug)})`);
      expect(full).toContain(`/en/techniques/${publicSlug(slug)}`);
    }
    expect(index.startsWith("# FocusKept\n\n> ")).toBe(true);
    expect(full).not.toMatch(/\{\w+\}/); // no unfilled ICU placeholders
  });

  it("lets AI crawlers in but keeps the app and API private", () => {
    const rules = [robots().rules].flat();
    const ai = rules.find((r) => [r.userAgent].flat().includes("GPTBot"));
    expect(ai?.allow).toBe("/");
    expect(ai?.disallow).toContain("/api/");
  });
});
