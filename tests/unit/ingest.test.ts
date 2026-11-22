// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { resolveTargetUrl, filterSafeHeaders } from "@/app/ingest/[...path]/route";

describe("ingest reverse proxy", () => {
  const ingestHost = "https://us.i.posthog.com";
  const assetsHost = "https://us-assets.i.posthog.com";

  it("maps /static/* paths to the assets host", () => {
    const target = resolveTargetUrl(
      ["static", "array.js"],
      "?v=1.438.10",
      ingestHost,
      assetsHost,
    );
    expect(target).toBe("https://us-assets.i.posthog.com/static/array.js?v=1.438.10");
  });

  it("maps API paths like /e/ or /decide/ to the ingestion host", () => {
    const eventTarget = resolveTargetUrl(
      ["e"],
      "?ip=1",
      ingestHost,
      assetsHost,
    );
    expect(eventTarget).toBe("https://us.i.posthog.com/e?ip=1");

    const decideTarget = resolveTargetUrl(
      ["decide"],
      "?v=3",
      ingestHost,
      assetsHost,
    );
    expect(decideTarget).toBe("https://us.i.posthog.com/decide?v=3");
  });

  it("strips cookies, auth, and other internal headers", () => {
    const headers = new Headers({
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 Test",
      cookie: "session=secret; fk_attr=test",
      authorization: "Bearer secret-token",
      host: "focuskept.local",
      "cf-connecting-ip": "203.0.113.195",
    });

    const filtered = filterSafeHeaders(headers);
    expect(filtered.get("content-type")).toBe("application/json");
    expect(filtered.get("user-agent")).toBe("Mozilla/5.0 Test");
    expect(filtered.get("cookie")).toBeNull();
    expect(filtered.get("authorization")).toBeNull();
    expect(filtered.get("host")).toBeNull();
    expect(filtered.get("x-forwarded-for")).toBe("203.0.113.195");
  });
});
