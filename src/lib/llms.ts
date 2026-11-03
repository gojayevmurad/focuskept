// /llms.txt and /llms-full.txt (llmstxt.org): a plain-markdown map of the site
// for AI assistants and answer engines. Built from the English copy so it
// stays in sync with the pages; every link points at the canonical /en URL.
import messages from "@/messages/en.json";
import techniques from "@/content/techniques/en.json";
import { brand } from "@/src/config/brand";
import { localeInfo, locales } from "@/src/i18n/config";
import { PRICES_USD } from "@/src/lib/billing/plans";
import {
  LEARNING_METHODS,
  PLANNING_TECHNIQUES,
  TIME_TECHNIQUES,
  type TechniqueSlug,
  publicSlug,
} from "@/src/features/techniques/slugs";
import { pageUrl } from "./seo";
import { appUrl } from "./site";

type Technique = (typeof techniques)[keyof typeof techniques];
const technique = (slug: TechniqueSlug) =>
  (techniques as Record<string, Technique>)[slug];

const { landing, pricing, meta, techniquesPage } = messages;
const LOOP = ["focus", "explain", "questions", "review"] as const;
const FAQ = ["1", "2", "3", "4", "5"] as const;
const GROUPS = [
  ["time", TIME_TECHNIQUES],
  ["learning", LEARNING_METHODS],
  ["planning", PLANNING_TECHNIQUES],
] as const;

const url = (path = "/") => pageUrl("en", path);

function intro() {
  return [
    `# ${brand.name}`,
    "",
    `> ${landing.heroLead}`,
    "",
    "Key facts:",
    "",
    `- Web app at ${url()}; works in any modern browser and installs as a PWA on phones and desktops.`,
    "- The focus timer works without an account. Learning mode (knowledge cards, AI questions, review reminders) needs a free account.",
    `- Pricing: Free plan, or Pro at $${PRICES_USD.monthly}/month or $${PRICES_USD.yearly}/year (USD).`,
    "- Spaced reviews on day 5, 10 and 30 by default (adjustable).",
    "- AI feedback and question generation use OpenAI; users are told not to include personal data.",
    `- Available in ${locales.length} languages.`,
    `- Contact: ${brand.supportEmail}`,
    "",
    `## ${landing.loop.title}`,
    "",
    landing.loop.lead,
    "",
    ...LOOP.map(
      (key, i) =>
        `${i + 1}. **${landing.loop[key].title}**: ${landing.loop[key].text}`,
    ),
  ];
}

function plans() {
  return [
    "## Pricing",
    "",
    pricing.lead,
    "",
    `- **${pricing.free.name}** ($0): ${Object.values(pricing.free.points).join("; ")}.`,
    `- **${pricing.pro.name}** ($${PRICES_USD.monthly}/month or $${PRICES_USD.yearly}/year): ${Object.values(pricing.pro.points).join("; ")}.`,
    "",
    `Details: [${meta.pricingTitle}](${url("/pricing")})`,
  ];
}

function faq() {
  return [
    "## FAQ",
    "",
    ...FAQ.flatMap((n) => [
      `### ${landing.faq[n].q}`,
      "",
      landing.faq[n].a,
      "",
    ]),
    ...FAQ.flatMap((n) => [
      `### ${pricing.faq[n].q}`,
      "",
      pricing.faq[n].a,
      "",
    ]),
  ];
}

function languages() {
  return [
    "## Languages",
    "",
    locales
      .map((l) => `[${localeInfo[l].nativeName}](${pageUrl(l)})`)
      .join(" · "),
  ];
}

function techniqueIndex() {
  return GROUPS.flatMap(([group, slugs]) => [
    `## ${techniquesPage.groups[group]}`,
    "",
    ...slugs.map((slug) => {
      const c = technique(slug);
      return `- [${c.name}](${url(`/techniques/${publicSlug(slug)}`)}): ${c.tagline}`;
    }),
    "",
  ]);
}

function techniqueArticle(slug: TechniqueSlug) {
  const c = technique(slug);
  const list = (items: string[]) => items.map((s) => `- ${s}`);
  return [
    `### ${c.name}`,
    "",
    `Source: ${url(`/techniques/${publicSlug(slug)}`)}`,
    "",
    `${c.tagline} ${c.summary}`,
    "",
    ...c.howItWorks.flatMap((p) => [p, ""]),
    `**${techniquesPage.steps}**`,
    "",
    ...c.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `**${techniquesPage.bestFor}**`,
    "",
    ...list(c.bestFor),
    "",
    `**${techniquesPage.whenNotToUse}**`,
    "",
    ...list(c.whenNotToUse),
    "",
    ...c.faq.flatMap((f) => [`**${f.q}** ${f.a}`, ""]),
  ];
}

const PAGES = [
  [meta.focusTitle, "/focus", meta.focusDescription],
  [meta.learnTitle, "/learn", meta.learnDescription],
  [meta.techniquesTitle, "/techniques", meta.techniquesDescription],
  [meta.pricingTitle, "/pricing", meta.pricingDescription],
] as const;

/** The short index: what FocusKept is and where everything lives. */
export function llmsTxt() {
  return [
    ...intro(),
    "",
    "## Pages",
    "",
    ...PAGES.map(([name, path, text]) => `- [${name}](${url(path)}): ${text}`),
    "",
    ...techniqueIndex(),
    ...plans(),
    "",
    ...languages(),
    "",
    "## Optional",
    "",
    `- [Full text for AI assistants](${appUrl()}/llms-full.txt): every technique guide and the FAQ in one file`,
    `- [About](${url("/about")})`,
    `- [Privacy policy](${url("/privacy")})`,
    `- [Terms of service](${url("/terms")})`,
    "",
  ].join("\n");
}

/** Everything in one document: the index plus each technique guide and the FAQ. */
export function llmsFullTxt() {
  return [
    ...intro(),
    "",
    ...plans(),
    "",
    ...faq(),
    ...GROUPS.flatMap(([group, slugs]) => [
      `## ${techniquesPage.groups[group]}`,
      "",
      ...slugs.flatMap(techniqueArticle),
    ]),
    ...languages(),
    "",
  ].join("\n");
}
