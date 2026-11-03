import { describe, it, expect } from "vitest";
import {
  registry,
  techniquesByGroup,
} from "@/src/features/techniques/registry";
import {
  ALL_TECHNIQUES,
  publicSlug,
  slugFromPublic,
} from "@/src/features/techniques/slugs";
import content from "@/content/techniques/en.json";

describe("technique registry", () => {
  it("has 18 techniques: 6 time, 8 learning, 4 planning", () => {
    expect(ALL_TECHNIQUES).toHaveLength(18);
    expect(techniquesByGroup.time).toHaveLength(6);
    expect(techniquesByGroup.learning).toHaveLength(8);
    expect(techniquesByGroup.planning).toHaveLength(4);
  });
  it("maps public URL segments back to stored ids", () => {
    expect(publicSlug("pomodoro")).toBe("25-5");
    expect(slugFromPublic("25-5")).toBe("pomodoro");
    expect(slugFromPublic("pomodoro")).toBeUndefined();
    for (const slug of ALL_TECHNIQUES) {
      expect(slugFromPublic(publicSlug(slug))).toBe(slug);
    }
  });
  it("links only to existing techniques, never to itself", () => {
    for (const entry of Object.values(registry)) {
      for (const related of entry.related) {
        expect(registry[related], `${entry.slug} → ${related}`).toBeDefined();
        expect(related).not.toBe(entry.slug);
      }
    }
  });
  it("has complete English content for every technique", () => {
    for (const slug of ALL_TECHNIQUES) {
      const c = (content as Record<string, (typeof content)["pomodoro"]>)[slug];
      expect(c, slug).toBeDefined();
      expect(c.steps.length, slug).toBeGreaterThanOrEqual(3);
      expect(c.faq.length, slug).toBeGreaterThanOrEqual(3);
      expect(c.faq.length, slug).toBeLessThanOrEqual(5);
      expect(c.bestFor.length, slug).toBeGreaterThanOrEqual(1);
      expect(c.seoTitle.length, slug).toBeLessThanOrEqual(62);
      expect(c.seoDescription.length, slug).toBeLessThanOrEqual(160);
    }
  });
});
