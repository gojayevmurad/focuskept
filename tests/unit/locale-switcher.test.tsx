// SPDX-License-Identifier: AGPL-3.0-only
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import {
  localeKeyAction,
  LocaleSwitcher,
} from "@/src/components/locale-switcher";

vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "writing" }) }));
vi.mock("@/src/i18n/navigation", () => ({
  usePathname: () => "/blog/[slug]",
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("locale picker keyboard behaviour", () => {
  it.each(["Enter", " ", "ArrowDown", "ArrowUp"])(
    "%s opens the list with focus on the current language",
    (key) =>
      expect(localeKeyAction(key, false, 0, 2)).toEqual({
        type: "focus",
        index: 2,
      }),
  );
  it("moves through options in either direction, wrapping at both ends", () => {
    expect(localeKeyAction("ArrowDown", true, 2, 0)).toEqual({
      type: "focus",
      index: 3,
    });
    expect(localeKeyAction("ArrowUp", true, 2, 0)).toEqual({
      type: "focus",
      index: 1,
    });
    expect(localeKeyAction("ArrowDown", true, 4, 0)).toEqual({
      type: "focus",
      index: 0,
    });
    expect(localeKeyAction("ArrowUp", true, 0, 0)).toEqual({
      type: "focus",
      index: 4,
    });
  });
  it.each(["Enter", " "])("%s selects only the focused option", (key) => {
    expect(localeKeyAction(key, true, 3, 0)).toEqual({
      type: "select",
      index: 3,
    });
  });
  it("Escape dismisses and restores focus; Tab dismisses without stealing focus", () => {
    expect(localeKeyAction("Escape", true, 2, 0)).toEqual({
      type: "close",
      restoreFocus: true,
    });
    expect(localeKeyAction("Tab", true, 2, 0)).toEqual({
      type: "close",
      restoreFocus: false,
    });
    expect(localeKeyAction("Escape", false, 0, 0)).toBeNull();
    expect(localeKeyAction("Tab", false, 0, 0)).toBeNull();
  });
  it("supports Home and End only while the list is open", () => {
    expect(localeKeyAction("Home", true, 2, 0)).toEqual({
      type: "focus",
      index: 0,
    });
    expect(localeKeyAction("End", true, 2, 0)).toEqual({
      type: "focus",
      index: 4,
    });
    expect(localeKeyAction("Home", false, 2, 0)).toBeNull();
    expect(localeKeyAction("a", true, 2, 0)).toBeNull();
  });
  it("renders a named disclosure with the current native language", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="fr" messages={{}} timeZone="UTC">
        <LocaleSwitcher label="Langue" />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('aria-label="Langue: Français"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('lang="fr"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain('role="listbox"');
  });
});
