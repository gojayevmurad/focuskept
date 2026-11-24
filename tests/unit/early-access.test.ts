// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import de from "@/messages/de.json";
import fr from "@/messages/fr.json";
import nl from "@/messages/nl.json";
import es from "@/messages/es.json";

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  getAppConfig: vi.fn(),
  getLanesTranslations: vi.fn(),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: vi.fn(),
}));
vi.mock("@/src/config/app", () => ({ getAppConfig: mocks.getAppConfig }));
vi.mock("@/src/config/env", () => ({ getEnv: () => ({}) }));
vi.mock("@/src/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/src/components/marketing/cta", () => ({
  Cta: () => null,
  SessionTimeline: () => null,
  getLanesTranslations: mocks.getLanesTranslations,
}));
vi.mock("@/src/components/marketing/pool-demo", () => ({
  BookingLink: () => "Book a session",
  PoolDemo: () => null,
}));
import Home from "@/app/[locale]/(marketing)/page";
import FaqPage from "@/app/[locale]/(marketing)/faq/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getAppConfig.mockReturnValue({
    name: "Study Hall",
    url: "https://studyhall.example",
    marketingEnabled: true,
    billingEnabled: false,
    freeWeeklySessions: 3,
  });
  mocks.getLanesTranslations.mockResolvedValue(
    createTranslator({ locale: "en", messages: en, namespace: "home" }),
  );
});

describe.each(Object.entries({ en, de, fr, nl, es }))(
  "early access in %s",
  (locale, messages) => {
    // Rendered with a self-hosted APP_NAME, so the copy must not say FocusKept.
    const question = messages.faqPage.earlyAccess.q.replace(
      "{app}",
      "Study Hall",
    );
    const answer = messages.faqPage.earlyAccess.a.replace(
      "{app}",
      "Study Hall",
    );

    beforeEach(() => {
      mocks.getTranslations.mockImplementation(
        async (namespace: "home" | "faqPage") =>
          createTranslator({ locale, messages, namespace }),
      );
    });

    it("shows the translated notice beside the main CTA and as the first FAQ", async () => {
      const props = { params: Promise.resolve({ locale }) };
      const home = renderToStaticMarkup(await Home(props));
      const faq = renderToStaticMarkup(await FaqPage(props));
      expect(home).toContain(answer);
      expect(home.indexOf(answer)).toBeGreaterThan(
        home.indexOf("Book a session"),
      );
      expect(faq).toContain(answer);
      const summaries = [...faq.matchAll(/<summary>(.*?)<\/summary>/g)];
      expect(summaries[0][1]).toContain(question);
      expect(home).not.toContain("FocusKept");
      expect(faq).not.toContain("FocusKept");
      // The visible answer and the FAQ schema must agree.
      const schema = JSON.parse(faq.match(/<script[^>]*>(.*?)<\/script>/)![1]);
      const faqSchema = schema["@graph"].find(
        (node: { "@type": string }) => node["@type"] === "FAQPage",
      );
      expect(faqSchema.mainEntity[0].acceptedAnswer.text).toBe(answer);
    });

    it("omits the notice and its FAQ/schema entry when billing is enabled", async () => {
      mocks.getAppConfig.mockReturnValue({
        ...mocks.getAppConfig(),
        billingEnabled: true,
      });
      const props = { params: Promise.resolve({ locale }) };
      for (const page of [Home, FaqPage]) {
        const html = renderToStaticMarkup(await page(props));
        expect(html).not.toContain(answer);
        expect(html).not.toContain(question);
      }
    });
  },
);
