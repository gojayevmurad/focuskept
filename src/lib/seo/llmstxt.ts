// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { getAppConfig } from "@/src/config/app";
import { getPrices } from "@/src/lib/content/prices";
import { listSeoPages, templates } from "@/src/lib/content/seo";
import { listBlogPosts } from "@/src/lib/content/blog";
import { getTranslations } from "next-intl/server";

export async function buildLlmsTxt(): Promise<string> {
  const app = getAppConfig();
  const url = (path: string) => new URL(path, app.url).toString();
  const prices = await getPrices();

  let pricingFact = "Pricing: Free plan includes 3 sessions per week.";
  if (!app.billingEnabled) {
    pricingFact =
      "Pricing: All features are included for free on this instance (unlimited sessions, partner matching, streaks).";
  } else if (prices?.monthly && prices?.yearly) {
    pricingFact = `Pricing: Free plan includes 3 sessions per week; Plus plan (${prices.monthly}/month or ${prices.yearly}/year, billed annually with a 7-day free trial) includes unlimited sessions, favorite partners, and advanced filters.`;
  } else {
    pricingFact =
      "Pricing: Free plan includes 3 sessions per week; Plus plan with a 7-day free trial includes unlimited sessions, favorite partners, and advanced filters (rates shown at checkout).";
  }

  const lines: string[] = [
    `# ${app.name}`,
    "",
    `> ${app.name} is an open-source (AGPL-3.0) body-doubling and virtual coworking web application. People book 25, 50, or 75-minute 1:1 video focus sessions starting on the hour or half-hour to work alongside an accountability partner with quiet focus and mutual check-ins.`,
    "",
    "## Key Facts",
    "",
    `- Product: ${app.name} — open-source body-doubling and virtual coworking web app`,
    "- License: AGPL-3.0 (open source, self-hostable)",
    "- Format: 25, 50, and 75-minute 1:1 video focus sessions starting on the hour and half-hour",
    "- Rhythm: Check-in (cameras on, declare goal), quiet focus (microphones muted), wrap-up (mark task done, partial, or not done)",
    "- Privacy & Safety: Zero recordings; live WebRTC video only; no screen sharing; one-click report and block",
    "- Target Audience: Remote workers, students, people with ADHD, writers, software engineers, lawyers, founders, freelancers, and researchers",
    `- ${pricingFact}`,
    "- Features: 1:1 partner matching, hosted group sessions (up to 9 participants), communities/groups, monthly challenges, day & weekly streaks, public personal booking page (/u/<username>)",
    "- Languages: English (en, default), German (de), French (fr), Dutch (nl), Spanish (es)",
    "",
    "## Core Pages",
    "",
    `- [How It Works](${url("/how-it-works")}): Step-by-step walkthrough of session stages, partner matching, fallback options, etiquette, and safety.`,
    `- [Frequently Asked Questions](${url("/faq")}): Answers to common questions about sessions, camera expectations, privacy, and plans.`,
  ];

  if (app.billingEnabled) {
    lines.push(
      `- [Pricing](${url("/pricing")}): Free plan (3 sessions/week) and Plus plan options with a 7-day free trial.`,
    );
  }

  lines.push("", "## Use Cases and Audiences", "");
  for (const template of templates) {
    if (template === "alternatives") continue;
    const pages = listSeoPages(template, "en");
    for (const page of pages) {
      lines.push(
        `- [${page.h1}](${url(`/${template}/${page.slug}`)}): ${page.description}`,
      );
    }
  }

  lines.push("", "## Comparisons", "");
  const altPages = listSeoPages("alternatives", "en");
  for (const page of altPages) {
    lines.push(
      `- [${page.h1}](${url(`/alternatives/${page.slug}`)}): ${page.description}`,
    );
  }

  lines.push("", "## Blog", "");
  const posts = listBlogPosts();
  for (const post of posts) {
    lines.push(`- [${post.title}](${url(`/blog/${post.slug}`)}): ${post.description}`);
  }

  return lines.join("\n") + "\n";
}

export async function buildLlmsFullTxt(): Promise<string> {
  const base = await buildLlmsTxt();
  const [howT, faqT] = await Promise.all([
    getTranslations({ locale: "en", namespace: "how" }),
    getTranslations({ locale: "en", namespace: "faqPage" }),
  ]);

  const stages = howT.raw("stages") as { title: string; body: string }[];
  const groups = faqT.raw("groups") as {
    title: string;
    items: { q: string; a: string }[];
  }[];
  const posts = listBlogPosts();

  const extra: string[] = [
    "",
    "---",
    "",
    "## Full Documentation: How It Works",
    "",
    `### ${howT("heading")}`,
    "",
    howT("lead"),
    "",
    "#### Session Stages",
    "",
  ];

  for (const stage of stages) {
    extra.push(`##### ${stage.title}`, "", stage.body, "");
  }

  extra.push(
    `#### ${howT("matchingTitle")}`,
    "",
    howT("matchingBody"),
    "",
    howT("fallbackBody"),
    "",
    `#### ${howT("etiquetteTitle")}`,
    "",
    howT("etiquetteBody"),
    "",
    `#### ${howT("safetyTitle")}`,
    "",
    howT("safetyBody"),
    "",
    "---",
    "",
    "## Full Documentation: Frequently Asked Questions",
    "",
  );

  for (const group of groups) {
    extra.push(`### ${group.title}`, "");
    for (const item of group.items) {
      extra.push(`#### Q: ${item.q}`, "", item.a, "");
    }
  }

  extra.push("---", "", "## Full Articles: Blog", "");

  for (const post of posts) {
    extra.push(
      `### ${post.title}`,
      "",
      `Date: ${post.date} | Author: ${post.author}`,
      "",
      post.description,
      "",
      post.body,
      "",
      "---",
      "",
    );
  }

  return base + extra.join("\n");
}
