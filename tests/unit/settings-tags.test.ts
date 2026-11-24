// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { addTag, validTags } from "@/app/[locale]/(app)/settings/tags";
describe("settings custom tags", () => {
  it("accepts suggested and custom tags, normalizing spaces", () => {
    expect(addTag(["study"], "  language   learning ")).toEqual([
      "study",
      "language learning",
    ]);
    expect(validTags(["study", "language learning"])).toBe(true);
  });
  it("rejects blank, duplicate, oversized tags and a sixth tag", () => {
    const original = ["study"];
    for (const value of ["", "  ", "STUDY", "x".repeat(25)])
      expect(addTag(original, value)).toBe(original);
    const full = ["one", "two", "three", "four", "five"];
    expect(addTag(full, "six")).toBe(full);
    expect(validTags([...full, "six"])).toBe(false);
    expect(validTags(["study", "STUDY"])).toBe(false);
    expect(validTags([" x "])).toBe(false);
  });
});
