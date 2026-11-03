import { describe, expect, it } from "vitest";
import {
  gradeCloze,
  gradeTrueFalse,
  levenshtein,
  normalizeAnswer,
  reviewResult,
} from "@/src/features/reviews/grading";

describe("cloze grading", () => {
  it("ignores case, diacritics, punctuation and extra whitespace", () => {
    expect(normalizeAnswer("  Café  au   LAIT! ")).toBe("cafe au lait");
    expect(gradeCloze("Cafe", "café")).toBe("correct");
    expect(gradeCloze("Mitochondrien.", "mitochondrien")).toBe("correct");
    expect(gradeCloze("ŞƏKƏR", "şəkər")).toBe("correct");
    expect(gradeCloze("Ελληνικά", "ελληνικα")).toBe("correct");
  });
  it("tolerates small typos only in longer answers", () => {
    expect(gradeCloze("glucoes", "glucose")).toBe("correct");
    expect(gradeCloze("chlorofyll", "chlorophyll")).toBe("correct");
    expect(gradeCloze("cat", "car")).toBe("incorrect");
    expect(gradeCloze("sugar", "sugars")).toBe("correct");
    expect(gradeCloze("photosinthesis", "photosynthesis")).toBe("correct");
    expect(gradeCloze("respiration", "photosynthesis")).toBe("incorrect");
    expect(gradeCloze("", "sugar")).toBe("incorrect");
  });
  it("works for non-Latin scripts", () => {
    expect(gradeCloze("光合成", "光合成")).toBe("correct");
    expect(gradeCloze("السكر", "السكر")).toBe("correct");
    expect(levenshtein("光合成", "光合")).toBe(1);
  });
});

describe("true/false and review results", () => {
  it("grades true/false exactly", () => {
    expect(gradeTrueFalse("TRUE", "true")).toBe("correct");
    expect(gradeTrueFalse("false", "true")).toBe("incorrect");
  });
  it("passes only when every answer is correct", () => {
    expect(reviewResult(["correct", "correct"])).toEqual({
      passed: true,
      scorePct: 100,
    });
    expect(reviewResult(["correct", "partial"])).toEqual({
      passed: false,
      scorePct: 75,
    });
    expect(reviewResult(["incorrect", "correct", "correct"])).toEqual({
      passed: false,
      scorePct: 67,
    });
    expect(reviewResult([])).toEqual({ passed: false, scorePct: 0 });
  });
});
