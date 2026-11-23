// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { heardFromInput } from "@/src/lib/attribution/heard-from";

const sources = [
  "tiktok",
  "instagram",
  "youtube",
  "reddit",
  "google",
  "friend",
  "podcast",
  "other",
];

describe("self-reported onboarding attribution", () => {
  it.each(sources)("accepts %s", (heardFrom) => {
    expect(heardFromInput.parse({ heardFrom })).toEqual({ heardFrom });
  });

  it("allows skipping the question", () => {
    expect(heardFromInput.parse({})).toEqual({});
  });

  it.each(["unknown", "TikTok", "", null, 42])(
    "rejects unknown source %s",
    (heardFrom) => {
      expect(heardFromInput.safeParse({ heardFrom }).success).toBe(false);
    },
  );

  it("keeps trimmed Other text only for other", () => {
    expect(
      heardFromInput.parse({
        heardFrom: "other",
        heardFromOther: "  Community newsletter  ",
      }),
    ).toEqual({ heardFrom: "other", heardFromOther: "Community newsletter" });
    for (const heardFrom of [
      ...sources.filter((source) => source !== "other"),
      undefined,
    ]) {
      const result = heardFromInput.parse({
        heardFrom,
        heardFromOther: "Private text",
      });
      expect(result).not.toHaveProperty("heardFromOther");
    }
  });

  it("omits blank Other text and allows other without details", () => {
    for (const heardFromOther of [undefined, "", "  \n\t\u0000  "]) {
      expect(
        heardFromInput.parse({ heardFrom: "other", heardFromOther }),
      ).toEqual({ heardFrom: "other" });
    }
  });

  it("strips control characters before trimming and truncating to 60 characters", () => {
    expect(
      heardFromInput.parse({
        heardFrom: "other",
        heardFromOther: " \u0000News\tletter\n\r\u007f\u0085 ",
      }),
    ).toEqual({ heardFrom: "other", heardFromOther: "Newsletter" });
    expect(
      heardFromInput.parse({
        heardFrom: "other",
        heardFromOther: `  ${"a".repeat(80)}  `,
      }).heardFromOther,
    ).toBe("a".repeat(60));
    expect(
      heardFromInput.parse({
        heardFrom: "other",
        heardFromOther: `${"a".repeat(59)} more`,
      }).heardFromOther,
    ).toBe("a".repeat(59));
  });
});
