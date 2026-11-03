import { test as base, expect } from "@playwright/test";

/**
 * `page.goto` also waits for hydration (html[data-hydrated], set by
 * HydrationMark): under a slow `next dev` a click right after load can reach
 * the button before React attaches its handler, and is then silently lost.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await page.waitForSelector("html[data-hydrated]", {
        state: "attached",
        timeout: 60_000,
      });
      return response;
    };
    await provide(page);
  },
});
export { expect };
export type { Page } from "@playwright/test";
