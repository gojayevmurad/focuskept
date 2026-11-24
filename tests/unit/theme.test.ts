// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import {
  currentTheme,
  cycleTheme,
  setTheme,
  THEME_INIT_SCRIPT,
} from "@/src/lib/theme";

beforeEach(() => {
  vi.stubGlobal("document", { documentElement: { dataset: {} } });
  vi.stubGlobal("localStorage", { setItem: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
describe("theme preference", () => {
  it("defaults to System and cycles System → Light → Dark → System", () => {
    expect(currentTheme()).toBe("system");
    for (const expected of ["light", "dark", "system"] as const) {
      setTheme(cycleTheme(currentTheme()));
      expect(currentTheme()).toBe(expected);
      expect(localStorage.setItem).toHaveBeenLastCalledWith("theme", expected);
    }
    // Absence of an override lets the existing CSS media query react live.
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
  it.each([null, "system", "invalid", "light", "dark"])(
    "pre-paint restores %s consistently",
    (saved) => {
      runInNewContext(THEME_INIT_SCRIPT, {
        document,
        localStorage: { getItem: () => saved },
      });
      expect(currentTheme()).toBe(
        saved === "light" || saved === "dark" ? saved : "system",
      );
    },
  );
  it("still follows the system when storage is blocked", () => {
    document.documentElement.dataset.theme = "dark";
    runInNewContext(THEME_INIT_SCRIPT, {
      document,
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(currentTheme()).toBe("system");
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => setTheme("light")).not.toThrow();
    expect(currentTheme()).toBe("light");
  });
});
