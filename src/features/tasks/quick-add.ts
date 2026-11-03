// Quick add: one line → title, duration, day, Eisenhower flags, tags.
// Keywords come from the locale's messages (comma-separated) plus English,
// so "Essay outline 45m tomorrow !" works everywhere.

export type QuickAddWords = {
  today: string[];
  tomorrow: string[];
  minutes: string[];
  hours: string[];
};

export type QuickAdd = {
  title: string;
  minutes: number | null;
  when: "today" | "tomorrow" | null;
  important: boolean;
  urgent: boolean;
  tags: string[];
};

const ENGLISH: QuickAddWords = {
  today: ["today"],
  tomorrow: ["tomorrow"],
  minutes: ["m", "min", "mins"],
  hours: ["h", "hr", "hrs"],
};

/** "a, b , c" → ["a", "b", "c"] for a messages entry. */
export function wordList(text: string) {
  return text
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `spaced` is false for scripts written without spaces (ja, zh): day words
 * then match anywhere in the line instead of as whole words.
 */
export function parseQuickAdd(
  line: string,
  words: QuickAddWords,
  spaced = true,
): QuickAdd {
  const all = {
    today: [...words.today, ...ENGLISH.today],
    tomorrow: [...words.tomorrow, ...ENGLISH.tomorrow],
    minutes: [...words.minutes, ...ENGLISH.minutes],
    hours: [...words.hours, ...ENGLISH.hours],
  };
  // A trailing "!" or "!!" is its own token ("today!!" → "today !!").
  let text = ` ${line.normalize("NFC")} `.replace(
    /(?<=[^\s!])(!{1,2})(?=\s)/gu,
    " $1",
  );
  let when: QuickAdd["when"] = null;
  // Longest phrases first, so "day after tomorrow"-style words can't be split.
  for (const [key, list] of [
    ["tomorrow", all.tomorrow],
    ["today", all.today],
  ] as const)
    for (const phrase of [...list].sort((a, b) => b.length - a.length)) {
      const re = spaced
        ? new RegExp(`(?<=\\s)${escape(phrase)}(?=\\s)`, "iu")
        : new RegExp(escape(phrase), "iu");
      if (re.test(text)) {
        when ??= key;
        text = text.replace(re, " ");
      }
    }

  const unit = (list: string[]) =>
    list
      .map(escape)
      .sort((a, b) => b.length - a.length)
      .join("|");
  const duration = new RegExp(
    `(?<=\\s)(\\d+(?:[.,]\\d+)?)\\s?(${unit(all.hours)}|${unit(all.minutes)})(?=\\s)`,
    "iu",
  );
  let minutes: number | null = null;
  const match = text.match(duration);
  if (match) {
    const value = Number(match[1].replace(",", "."));
    const isHours = all.hours.includes(match[2].toLowerCase());
    minutes = Math.round(isHours ? value * 60 : value);
    if (minutes < 1 || minutes > 1440) minutes = null;
    text = text.replace(duration, " ");
  }

  let important = false;
  let urgent = false;
  const tags: string[] = [];
  const title: string[] = [];
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (token === "!!") {
      important = urgent = true;
    } else if (token === "!") {
      important = true;
    } else if (token.startsWith("#") && token.length > 1) {
      const tag = token.slice(1).toLowerCase().slice(0, 32);
      if (!tags.includes(tag) && tags.length < 10) tags.push(tag);
    } else {
      title.push(token);
    }
  }
  return {
    title: title.join(" ").slice(0, 200),
    minutes,
    when,
    important,
    urgent,
    tags,
  };
}
