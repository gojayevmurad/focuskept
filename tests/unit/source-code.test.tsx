// SPDX-License-Identifier: AGPL-3.0-only
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppConfig } from "@/src/config/app";
import { SourceCode } from "@/src/components/marketing/source-code";

const labels = {
  label: "Source code",
  comingSoon: "Source code — coming soon",
};
afterEach(() => vi.unstubAllEnvs());

describe("source code configuration and control", () => {
  it("exposes the configured URL through app config", () => {
    vi.stubEnv("REPO_URL", "https://git.example.org/team/project");
    expect(getAppConfig().repoUrl).toBe("https://git.example.org/team/project");
    vi.stubEnv("REPO_URL", "");
    expect(getAppConfig().repoUrl).toBeUndefined();
  });
  it("renders an inert, focusable button and coming-soon label without a URL", () => {
    const html = renderToStaticMarkup(<SourceCode {...labels} />);
    expect(html).toContain('<button type="button" aria-disabled="true"');
    expect(html).toContain('aria-label="Source code — coming soon"');
    expect(html).toContain('title="Source code — coming soon"');
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<a ");
  });
  it("renders a named external link when configured, including the icon-only variant", () => {
    for (const iconOnly of [true, false]) {
      const html = renderToStaticMarkup(
        <SourceCode
          {...labels}
          url="https://git.example.org/team/project"
          iconOnly={iconOnly}
        />,
      );
      expect(html).toContain('href="https://git.example.org/team/project"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('aria-label="Source code"');
      expect(html).not.toContain("aria-disabled");
      expect(html).not.toContain("<button");
    }
  });
});
