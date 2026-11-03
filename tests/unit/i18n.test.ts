import { describe, it, expect } from "vitest";
import { run, checkMessages } from "../../scripts/i18n-check.mjs";
import {
  direction,
  isLocale,
  localeFromPath,
  locales,
  rtlLocales,
} from "@/src/i18n/config";

describe("locale configuration", () => {
  it("supports the 24 product locales with English as source", () => {
    expect(locales).toHaveLength(24);
    expect(locales[0]).toBe("en");
    expect(new Set(locales).size).toBe(24);
  });
  it.each(["ar", "fa", "ur"])("renders %s right-to-left", (locale) => {
    expect(direction(locale)).toBe("rtl");
  });
  it.each(["en", "de", "ja", "hi", "he-IL"])(
    "renders %s left-to-right",
    (locale) => expect(direction(locale)).toBe("ltr"),
  );
  it("lists exactly the RTL locales", () =>
    expect([...rtlLocales].sort()).toEqual(["ar", "fa", "ur"]));
  it("reads the locale prefix from a path", () => {
    expect(localeFromPath("/pt-BR/app/cards")).toBe("pt-BR");
    expect(localeFromPath("/zh-CN")).toBe("zh-CN");
    expect(localeFromPath("/xx/app")).toBeUndefined();
    expect(isLocale("EN")).toBe(false);
  });
});

describe("i18n-check", () => {
  it("passes for the repository messages", () => {
    const { errors } = run(process.cwd(), { requireAll: false });
    expect(errors).toEqual([]);
  });
  const en = {
    a: { count: "{count, plural, one {# card} other {# cards}}" },
    b: "Hello {name}, read the <terms>terms</terms>",
    c: "Start your focus session now",
  };
  it("accepts a complete, correct translation", () =>
    expect(
      checkMessages("de", en, {
        a: { count: "{count, plural, one {# Karte} other {# Karten}}" },
        b: "Hallo {name}, lies die <terms>Bedingungen</terms>",
        c: "Starte jetzt deine Fokus-Session",
      }),
    ).toEqual([]));
  it("reports missing and extra keys, placeholders and tags", () => {
    const errors = checkMessages("de", en, {
      a: { count: "{n, plural, one {# Karte} other {# Karten}}" },
      b: "Hallo {user}, lies die Bedingungen",
      x: "extra",
    });
    expect(errors.join("\n")).toMatch(/missing key c/);
    expect(errors.join("\n")).toMatch(/extra key x/);
    expect(errors.join("\n")).toMatch(/placeholders differ at a.count/);
    expect(errors.join("\n")).toMatch(/tags differ at b/);
  });
  it("requires every CLDR plural category (Arabic has six, Polish four)", () => {
    const ar = checkMessages("ar", en, {
      ...en,
      a: { count: "{count, plural, one {# بطاقة} other {# بطاقات}}" },
      b: "مرحبا {name} <terms>الشروط</terms>",
      c: "ابدأ جلسة التركيز الآن",
    });
    expect(ar.join("\n")).toMatch(/lacks categories zero, two, few, many/);
    const pl = checkMessages("pl", en, {
      a: {
        count:
          "{count, plural, one {# karta} few {# karty} many {# kart} other {# karty}}",
      },
      b: "Cześć {name}, przeczytaj <terms>regulamin</terms>",
      c: "Zacznij teraz sesję skupienia",
    });
    expect(pl).toEqual([]);
  });
  it("rejects invalid ICU and untranslated English", () => {
    const errors = checkMessages("fr", en, {
      a: { count: "{count, plural, one {# carte} other {# cartes}" },
      b: "Bonjour {name}, lis les <terms>conditions</terms>",
      c: "Start your focus session now",
    });
    expect(errors.join("\n")).toMatch(/invalid ICU at a.count/);
    expect(errors.join("\n")).toMatch(/untranslated English at c/);
  });
});
