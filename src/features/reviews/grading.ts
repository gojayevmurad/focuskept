// Deterministic grading for true/false and fill-in-the-blank questions.
export type Verdict = "correct" | "partial" | "incorrect";

/** Case-, diacritic-, punctuation- and whitespace-insensitive form of an answer. */
export function normalizeAnswer(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Edit distance where swapping two adjacent letters counts as one typo
 * (optimal string alignment, a restricted Damerau–Levenshtein distance). */
export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const x = [...a];
  const y = [...b];
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[x.length][y.length];
}

/** Typos are tolerated only in longer answers: 1 edit from 5 characters, 2 from 10. */
export function typoTolerance(expectedLength: number) {
  if (expectedLength >= 10) return 2;
  if (expectedLength >= 5) return 1;
  return 0;
}

export function gradeCloze(answer: string, expected: string): Verdict {
  const given = normalizeAnswer(answer);
  const target = normalizeAnswer(expected);
  if (!given) return "incorrect";
  if (given === target) return "correct";
  return levenshtein(given, target) <= typoTolerance([...target].length)
    ? "correct"
    : "incorrect";
}

export function gradeTrueFalse(answer: string, expected: string): Verdict {
  return normalizeAnswer(answer) === normalizeAnswer(expected)
    ? "correct"
    : "incorrect";
}

export function gradeByRule(
  type: "true_false" | "cloze",
  answer: string,
  expected: string,
): Verdict {
  return type === "cloze"
    ? gradeCloze(answer, expected)
    : gradeTrueFalse(answer, expected);
}

/** Pass = every answer correct (partial counts as a miss). Score gives partial half credit. */
export function reviewResult(verdicts: readonly Verdict[]) {
  if (!verdicts.length) return { passed: false, scorePct: 0 };
  const points = verdicts.reduce(
    (sum, v) => sum + (v === "correct" ? 1 : v === "partial" ? 0.5 : 0),
    0,
  );
  return {
    passed: verdicts.every((v) => v === "correct"),
    scorePct: Math.round((points / verdicts.length) * 100),
  };
}
