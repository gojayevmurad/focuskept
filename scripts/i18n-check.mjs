#!/usr/bin/env node
// Validates translations. It never generates or modifies text.
//
// Checks every locale against messages/en.json (the source of truth):
//   - key parity (missing / extra keys)
//   - valid ICU syntax
//   - placeholder ({name}) and rich-text tag (<b>…</b>) parity
//   - plural messages cover every CLDR category the locale needs
//   - no untranslated English left inside a non-English locale
// and the same key parity / untranslated checks for content/*/<locale>.json.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

export const LOCALES = [
  "en",
  "el",
  "nl",
  "hu",
  "cs",
  "es",
  "fr",
  "de",
  "it",
  "pl",
  "pt-BR",
  "tr",
  "ru",
  "uk",
  "ar",
  "fa",
  "ur",
  "ja",
  "ko",
  "zh-CN",
  "hi",
  "id",
  "vi",
  "az",
];

function flatten(tree, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value))
      flatten(value, path, out);
    else out.set(path, value);
  }
  return out;
}

function walk(nodes, info) {
  for (const node of nodes) {
    switch (node.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        info.args.add(node.value);
        break;
      case TYPE.tag:
        info.tags.add(node.value);
        walk(node.children, info);
        break;
      case TYPE.select:
        info.args.add(node.value);
        for (const option of Object.values(node.options))
          walk(option.value, info);
        break;
      case TYPE.plural:
        info.args.add(node.value);
        if (node.pluralType === "cardinal")
          info.plurals.push(Object.keys(node.options));
        for (const option of Object.values(node.options))
          walk(option.value, info);
        break;
    }
  }
  return info;
}

export function analyze(message) {
  return walk(parse(message, { requiresOtherClause: true }), {
    args: new Set(),
    tags: new Set(),
    plurals: [],
  });
}

const sameSet = (a, b) => a.size === b.size && [...a].every((v) => b.has(v));

/** Removes placeholders, tags and never-translated glossary terms. */
function translatableLetters(text, glossary) {
  let rest = text
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/<\/?[a-zA-Z0-9]+>/g, " ");
  for (const term of glossary) rest = rest.split(term).join(" ");
  return rest.replace(/[^\p{L}]/gu, "");
}

/** All strings inside a value (string, array or object), joined. */
function textOf(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join("\n");
  if (value && typeof value === "object")
    return Object.values(value).map(textOf).join("\n");
  return "";
}

/** Folds case and diacritics so inflected forms ("Pomodoróval") still match. */
function fold(text) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[-\u2010\u2011]/g, " ")
    .toLowerCase();
}

/** Whole-word match, so "Pro" does not match "Product". */
function hasTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "u",
  ).test(text);
}

/** Never-translate terms present in the English text but missing from the translation. */
function lostTerms(english, translated, glossary) {
  const theirs = fold(translated);
  return glossary.filter(
    (term) => hasTerm(english, term) && !theirs.includes(fold(term)),
  );
}

export function checkMessages(
  locale,
  source,
  target,
  glossary = [],
  identical = [],
) {
  const errors = [];
  const en = flatten(source);
  const tr = flatten(target);
  const categories = new Intl.PluralRules(locale).resolvedOptions()
    .pluralCategories;
  for (const key of en.keys())
    if (!tr.has(key)) errors.push(`${locale}: missing key ${key}`);
  for (const [key, value] of tr) {
    if (!en.has(key)) {
      errors.push(`${locale}: extra key ${key}`);
      continue;
    }
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`${locale}: empty or non-string value at ${key}`);
      continue;
    }
    let mine;
    let theirs;
    try {
      mine = analyze(value);
    } catch (error) {
      errors.push(`${locale}: invalid ICU at ${key}: ${error.message}`);
      continue;
    }
    try {
      theirs = analyze(en.get(key));
    } catch {
      continue; // reported for "en" itself
    }
    if (!sameSet(mine.args, theirs.args))
      errors.push(
        `${locale}: placeholders differ at ${key} (${[...mine.args]} vs ${[...theirs.args]})`,
      );
    if (!sameSet(mine.tags, theirs.tags))
      errors.push(
        `${locale}: tags differ at ${key} (${[...mine.tags]} vs ${[...theirs.tags]})`,
      );
    for (const options of mine.plurals) {
      const needed = categories.filter((c) => !options.includes(c));
      if (needed.length)
        errors.push(
          `${locale}: plural at ${key} lacks categories ${needed.join(", ")}`,
        );
      const invalid = options.filter(
        (o) => !o.startsWith("=") && !categories.includes(o),
      );
      if (invalid.length)
        errors.push(
          `${locale}: plural at ${key} has categories ${invalid.join(", ")} not used by ${locale}`,
        );
    }
    if (
      locale !== "en" &&
      value === en.get(key) &&
      !identical.includes(key) &&
      translatableLetters(value, glossary).length >= 4
    )
      errors.push(`${locale}: untranslated English at ${key}`);
    const lost = lostTerms(en.get(key), value, glossary);
    if (locale !== "en" && lost.length)
      errors.push(
        `${locale}: glossary terms changed at ${key} (${lost.join(", ")})`,
      );
  }
  return errors;
}

export function checkContent(
  locale,
  source,
  target,
  glossary = [],
  identical = [],
) {
  const errors = [];
  const en = flatten(source);
  const tr = flatten(target);
  for (const key of en.keys())
    if (!tr.has(key)) errors.push(`${locale}: missing content ${key}`);
  for (const [key, value] of tr) {
    if (!en.has(key)) errors.push(`${locale}: extra content ${key}`);
    else if (Array.isArray(value) !== Array.isArray(en.get(key)))
      errors.push(`${locale}: content shape differs at ${key}`);
    else if (Array.isArray(value) && value.length !== en.get(key).length)
      errors.push(
        `${locale}: ${key} has ${value.length} items, English has ${en.get(key).length}`,
      );
    else if (
      locale !== "en" &&
      lostTerms(textOf(en.get(key)), textOf(value), glossary).length
    )
      errors.push(
        `${locale}: glossary terms changed at ${key} (${lostTerms(textOf(en.get(key)), textOf(value), glossary).join(", ")})`,
      );
    else if (
      typeof value === "string" &&
      locale !== "en" &&
      value === en.get(key) &&
      !identical.includes(key) &&
      translatableLetters(value, glossary).length >= 4
    )
      errors.push(`${locale}: untranslated English content at ${key}`);
    else if (key.endsWith(".seoTitle") && [...value].length > SEO_TITLE_MAX)
      errors.push(`${locale}: ${key} longer than ${SEO_TITLE_MAX} characters`);
    else if (
      key.endsWith(".seoDescription") &&
      [...value].length > SEO_DESCRIPTION_MAX
    )
      errors.push(
        `${locale}: ${key} longer than ${SEO_DESCRIPTION_MAX} characters`,
      );
  }
  return errors;
}

const SEO_TITLE_MAX = 62;
const SEO_DESCRIPTION_MAX = 160;

export function run(root, { requireAll = true } = {}) {
  const errors = [];
  const warnings = [];
  const read = (path) => JSON.parse(readFileSync(path, "utf8"));
  const glossary = read(join(root, "messages/glossary.json")).neverTranslate;
  // Reviewed exceptions: keys whose correct local text equals the English
  // (e.g. established loanwords). Format: { "<locale>": ["key.path", …] }.
  const identicalFile = join(root, "messages/i18n-identical.json");
  const identical = existsSync(identicalFile) ? read(identicalFile) : {};
  const source = read(join(root, "messages/en.json"));
  for (const [key, value] of flatten(source))
    try {
      analyze(value);
    } catch (error) {
      errors.push(`en: invalid ICU at ${key}: ${error.message}`);
    }
  for (const locale of LOCALES.filter((l) => l !== "en")) {
    const file = join(root, `messages/${locale}.json`);
    if (!existsSync(file)) {
      (requireAll ? errors : warnings).push(`${locale}: messages file missing`);
      continue;
    }
    errors.push(
      ...checkMessages(
        locale,
        source,
        read(file),
        glossary,
        identical[locale] ?? [],
      ),
    );
  }
  const contentRoot = join(root, "content");
  if (existsSync(contentRoot))
    for (const kind of readdirSync(contentRoot)) {
      const base = join(contentRoot, kind, "en.json");
      if (!existsSync(base)) continue;
      const english = read(base);
      for (const locale of LOCALES.filter((l) => l !== "en")) {
        const file = join(contentRoot, kind, `${locale}.json`);
        if (!existsSync(file)) {
          (requireAll ? errors : warnings).push(
            `${locale}: content/${kind} missing`,
          );
          continue;
        }
        errors.push(
          ...checkContent(
            locale,
            english,
            read(file),
            glossary,
            identical[`${kind}:${locale}`] ?? [],
          ),
        );
      }
    }
  return { errors, warnings };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  // All 24 locales are translated: a missing locale file is an error.
  const TRANSLATIONS_COMPLETE = true;
  const requireAll =
    TRANSLATIONS_COMPLETE || process.env.I18N_REQUIRE_ALL === "1";
  const { errors, warnings } = run(root, { requireAll });
  for (const w of warnings) console.warn("warn  " + w);
  for (const e of errors) console.error("error " + e);
  console.log(
    `i18n-check: ${errors.length} error(s), ${warnings.length} warning(s)`,
  );
  process.exitCode = errors.length ? 1 : 0;
}
