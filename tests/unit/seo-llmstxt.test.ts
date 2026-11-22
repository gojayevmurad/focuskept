// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from "vitest";
import { buildLlmsTxt, buildLlmsFullTxt } from "@/src/lib/seo/llmstxt";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("@/messages/en.json")).default;
  return {
    getTranslations: async ({
      locale,
      namespace,
    }: {
      locale: string;
      namespace?: string;
    }) => createTranslator({ locale, messages, namespace } as never),
  };
});

describe("AI Context Files (llms.txt and llms-full.txt)", () => {
  it("generates valid llms.txt according to the llmstxt.org specification", async () => {
    const content = await buildLlmsTxt();

    expect(content.startsWith("# FocusKept")).toBe(true);
    expect(content).toContain("> FocusKept is an open-source (AGPL-3.0)");
    expect(content).toContain("## Key Facts");
    expect(content).toContain("- License: AGPL-3.0");
    expect(content).toContain("- Format: 25, 50, and 75-minute");

    expect(content).toContain("## Core Pages");
    expect(content).toContain("/how-it-works");
    expect(content).toContain("/faq");

    expect(content).toContain("## Use Cases and Audiences");
    expect(content).toContain("/body-doubling-for/adhd");

    expect(content).toContain("## Comparisons");
    expect(content).toContain("/alternatives/focusmate");

    expect(content).toContain("## Blog");
  });

  it("generates comprehensive llms-full.txt with complete documentation", async () => {
    const content = await buildLlmsFullTxt();

    expect(content).toContain("## Full Documentation: How It Works");
    expect(content).toContain("Session Stages");
    expect(content).toContain("Matching");
    expect(content).toContain("Keep your camera on.");

    expect(content).toContain(
      "## Full Documentation: Frequently Asked Questions",
    );
    expect(content).toContain("Q: What is body doubling?");

    expect(content).toContain("## Full Articles: Blog");
  });
});
