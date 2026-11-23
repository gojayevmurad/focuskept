// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { render } from "react-email";
import manifest from "@/brand/manifest.json";
import {
  brandFiles,
  brandGeometry,
  brandThemes,
  kitName,
} from "@/src/config/brand-assets";
import { emailBrand } from "@/src/lib/email/brand";
import { EmailLayout } from "@/src/lib/notifications/email-layout";

const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

describe("brand runtime files", () => {
  it("serves every runtime URL from a kit file that exists", () => {
    const urls = [
      brandFiles.favicon,
      brandFiles.iconSvg,
      brandFiles.appleTouchIcon,
      brandFiles.notificationIcon,
      brandFiles.emailLogo,
      ...Object.values(brandFiles.pwa),
    ];
    for (const url of urls) expect(existsSync(`public${url}`), url).toBe(true);
  });

  it("keeps the conventional root icons byte-identical to the kit", () => {
    const targets = manifest.exports.filter(
      (e): e is typeof e & { targetPath: string } => "targetPath" in e,
    );
    expect(targets.map((e) => e.targetPath).sort()).toEqual([
      "public/apple-touch-icon.png",
      "public/favicon.ico",
      "public/icon.svg",
    ]);
    for (const e of targets)
      expect(sha(e.targetPath), e.targetPath).toBe(e.sha256);
    // One source per URL: no competing app/ file conventions.
    for (const file of [
      "app/favicon.ico",
      "app/icon.svg",
      "app/apple-icon.png",
    ])
      expect(existsSync(file), file).toBe(false);
  });

  it("draws the React mark from the same geometry as the SVG masters", () => {
    const svg = readFileSync("public/brand/logo/symbol-primary.svg", "utf8");
    expect(svg).toContain(`d="${brandGeometry.left}"`);
    expect(svg).toContain(`transform="${brandGeometry.rightTransform}"`);
    const micro = readFileSync("public/icon.svg", "utf8");
    expect(micro).toContain(`d="${brandGeometry.microLeft}"`);
    expect(micro).toContain(`transform="${brandGeometry.offset}"`);
  });

  it("uses the kit tokens for the app's light and dark grounds", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain(`--bg: ${brandThemes.light.background};`);
    expect(css).toContain(`--bg: ${brandThemes.dark.background};`);
    const brandCss = readFileSync("src/config/brand.css", "utf8");
    expect(brandCss).toContain(`--accent: ${brandThemes.light.accent};`);
    expect(brandCss).toContain(`--accent: ${brandThemes.dark.accent};`);
  });

  it("points notifications at the PNG icon", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).toContain(`icon: "${brandFiles.notificationIcon}"`);
    // Click handling still refuses other origins.
    expect(sw).toContain("if (url.origin !== self.location.origin) return;");
  });
});

describe("email identity", () => {
  const base = { name: kitName, url: "https://focuskept.com" };

  it("shows the kit lockup only for the FocusKept identity", () => {
    expect(emailBrand(base).logo).toEqual({
      src: "https://focuskept.com/brand/email/logo-badge-480.png",
      width: 160,
      height: 48,
    });
    expect(emailBrand({ ...base, name: "Study Hall" }).logo).toBeNull();
    // A custom LOGO_URL is never fetched or embedded in mail.
    expect(
      emailBrand({ ...base, logoUrl: "https://cdn.example.com/x.svg" }).logo,
    ).toBeNull();
  });

  it("renders email-safe HTML with a text fallback for the logo", async () => {
    const html = await render(
      EmailLayout({
        brand: emailBrand(base),
        preview: "Preview",
        heading: "Verify your email",
        lines: ["Use the secure link below."],
        cta: {
          label: "Verify",
          url: "https://focuskept.com/api/auth/x?t=1&u=2",
        },
        footer: "Footer",
        unsubscribeUrl: "https://focuskept.com/api/email/unsubscribe?token=a",
        unsubscribeLabel: "Unsubscribe",
      }),
    );
    expect(html).toContain(
      'src="https://focuskept.com/brand/email/logo-badge-480.png"',
    );
    expect(html).toMatch(/alt="FocusKept"/);
    expect(html).toMatch(/width="160"/);
    expect(html).toContain(
      'href="https://focuskept.com/api/auth/x?t=1&amp;u=2"',
    );
    expect(html).toContain(
      "https://focuskept.com/api/email/unsubscribe?token=a",
    );
    expect(html).toContain('name="color-scheme" content="light only"');
    expect(html).not.toMatch(/var\(--|color-mix|display:\s*grid/);
  });

  it("uses the deployment name as text for custom identities", async () => {
    const html = await render(
      EmailLayout({
        brand: emailBrand({ ...base, name: "Study Hall" }),
        preview: "p",
        heading: "h",
        lines: ["l"],
      }),
    );
    expect(html).toContain("Study Hall");
    expect(html).not.toContain("/brand/email/");
    expect(html).not.toContain("FocusKept");
  });
});
