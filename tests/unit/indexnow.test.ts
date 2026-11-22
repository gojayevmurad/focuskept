// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { submitIndexNow } from "@/src/lib/seo/indexnow";

describe("IndexNow Protocol Client", () => {
  it("returns disabled when INDEXNOW_KEY is not configured", async () => {
    const result = await submitIndexNow(["https://focuskept.com/"]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("disabled");
    }
  });

  it("returns empty when no URLs are supplied", async () => {
    // Save original env
    const origKey = process.env.INDEXNOW_KEY;
    process.env.INDEXNOW_KEY = "testkey1234567890";

    try {
      const result = await submitIndexNow([]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe("empty");
      }
    } finally {
      if (origKey !== undefined) {
        process.env.INDEXNOW_KEY = origKey;
      } else {
        delete process.env.INDEXNOW_KEY;
      }
    }
  });
});
