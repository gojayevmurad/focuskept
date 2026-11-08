// Quick add: one line → title, duration, day, Eisenhower flags, tags.
// Keywords come from the locale's messages (comma-separated) plus English,
// so "Essay outline 45m tomorrow !" works everywhere. Every recognised part
// is reported as a span of the original line, so the input can highlight it.

export type QuickAddWords = {
  today: string[];
  tomorrow: string[];
  minutes: string[];
  hours: string[];
  /** Weekday names by day number, 0 = Sunday. */
  weekdays?: string[][];
};

export type QuickAddSpan = {
  start: number;
  end: number;
  kind: "day" | "duration" | "priority" | "tag";
};

export type QuickAdd = {
  title: string;
  minutes: number | null;
  when: "today" | "tomorrow" | null;
  /** A named weekday (0 = Sunday) when no today/tomorrow word was used. */
  weekday: number | null;
  important: boolean;
  urgent: boolean;
  tags: string[];
  spans: QuickAddSpan[];
};

const ENGLISH: QuickAddWords = {
  today: ["today"],
  tomorrow: ["tomorrow"],
  minutes: ["m", "min", "mins", "minute", "minutes"],
  hours: ["h", "hr", "hrs", "hour", "hours"],
  weekdays: [
    ["sunday"],
    ["monday"],
    ["tuesday"],
    ["wednesday"],
    ["thursday"],
    ["friday"],
    ["saturday"],
  ],
};

/** "a, b , c" → ["a", "b", "c"] for a messages entry. */
export function wordList(text: string) {
  return text
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

/** Long weekday names in `locale`, 0 = Sunday (from Intl, so every language has them). */
export function weekdayNames(locale: string) {
  const format = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
  // 2026-11-01 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => [
    format.format(new Date(Date.UTC(2026, 10, 1 + i, 12))).toLowerCase(),
  ]);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const longestFirst = (list: readonly string[]) =>
  [...new Set(list)].sort((a, b) => b.length - a.length);

/**
 * `spaced` is false for scripts written without spaces (ja, zh): day words
 * then match anywhere in the line instead of as whole words. Spans starting
 * at an offset in `ignore` stay part of the title.
 */
export function parseQuickAdd(
  line: string,
  words: QuickAddWords,
  spaced = true,
  ignore: ReadonlySet<number> = new Set(),
): QuickAdd {
  const text = line.normalize("NFC");
  const spans: QuickAddSpan[] = [];
  const free = (start: number, end: number) =>
    !ignore.has(start) && spans.every((s) => end <= s.start || start >= s.end);
  // A word ends at a space, the end of the line or a trailing "!".
  const word = (body: string) =>
    spaced ? `(?<=^|\\s)(?:${body})(?=$|\\s|!)` : `(?:${body})`;
  const find = (pattern: string, kind: QuickAddSpan["kind"]) => {
    for (const m of text.matchAll(new RegExp(pattern, "giu"))) {
      const start = m.index;
      const end = start + m[0].length;
      if (free(start, end)) {
        spans.push({ start, end, kind });
        return m;
      }
    }
    return null;
  };

  let when: QuickAdd["when"] = null;
  let weekday: number | null = null;
  for (const [key, list] of [
    ["tomorrow", [...words.tomorrow, ...ENGLISH.tomorrow]],
    ["today", [...words.today, ...ENGLISH.today]],
  ] as const)
    if (!when && find(word(longestFirst(list).map(escape).join("|")), "day"))
      when = key;
  if (!when) {
    // All days in one pattern, longest name first: "bazar ertəsi" (Monday)
    // must win over "bazar" (Sunday).
    const dayOf = new Map<string, number>();
    for (let day = 0; day < 7; day++)
      for (const name of [
        ...(words.weekdays?.[day] ?? []),
        ...ENGLISH.weekdays![day],
      ])
        dayOf.set(name.toLowerCase(), day);
    const m = find(
      word(
        longestFirst([...dayOf.keys()])
          .map(escape)
          .join("|"),
      ),
      "day",
    );
    if (m) weekday = dayOf.get(m[0].toLowerCase()) ?? null;
  }

  const unit = (list: string[]) => longestFirst(list).map(escape).join("|");
  const hours = [...words.hours, ...ENGLISH.hours];
  const minutesWords = [...words.minutes, ...ENGLISH.minutes];
  let minutes: number | null = null;
  for (const m of text.matchAll(
    new RegExp(
      `(?<=^|\\s)(\\d+(?:[.,]\\d+)?)\\s?(${unit(hours)}|${unit(minutesWords)})(?=$|\\s|!)`,
      "giu",
    ),
  )) {
    const value = Number(m[1].replace(",", "."));
    const isHours = hours.includes(m[2].toLowerCase());
    const total = Math.round(isHours ? value * 60 : value);
    const start = m.index;
    const end = start + m[0].length;
    if (total >= 1 && total <= 1440 && free(start, end)) {
      minutes = total;
      spans.push({ start, end, kind: "duration" });
      break;
    }
  }

  let important = false;
  let urgent = false;
  for (const m of text.matchAll(/(?<!!)!{1,2}(?=$|\s)/gu)) {
    const start = m.index;
    if (!free(start, start + m[0].length)) continue;
    spans.push({ start, end: start + m[0].length, kind: "priority" });
    important = true;
    if (m[0].length === 2) urgent = true;
  }

  const tags: string[] = [];
  for (const m of text.matchAll(/(?<=^|\s)#([^\s#]+)/gu)) {
    const start = m.index;
    const tag = m[1].toLowerCase().slice(0, 32);
    if (!free(start, start + m[0].length) || tags.length >= 10) continue;
    spans.push({ start, end: start + m[0].length, kind: "tag" });
    if (!tags.includes(tag)) tags.push(tag);
  }

  spans.sort((a, b) => a.start - b.start);
  let title = "";
  let at = 0;
  for (const s of spans) {
    title += `${text.slice(at, s.start)} `;
    at = s.end;
  }
  title += text.slice(at);
  return {
    title: title.replace(/\s+/g, " ").trim().slice(0, 200),
    minutes,
    when,
    weekday,
    important,
    urgent,
    tags,
    spans,
  };
}
