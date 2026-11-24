// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from "vitest";
vi.mock("next-intl/middleware", () => ({ default: () => vi.fn() }));
import { config } from "../../proxy";

const matcher = new RegExp(`^${config.matcher[0]}$`);
describe("locale proxy matcher", () => {
  it.each([
    "/r/abc123",
    "/r/another-code",
    "/r/",
    "/api/auth",
    "/ingest/event",
    "/_next/static",
    "/_vercel/speed",
    "/icon.svg",
  ])("skips %s", (path) => {
    expect(matcher.test(path)).toBe(false);
  });
  it.each([
    "/",
    "/r",
    "/rooms",
    "/report",
    "/dashboard",
    "/session/id",
    "/de/book",
    "/fr/pricing",
    "/nl/dashboard",
    "/es/book",
  ])("keeps routing %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });
});
