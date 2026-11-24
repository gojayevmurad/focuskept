// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check, Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { locales, type Locale } from "@/src/i18n/routing";
import styles from "./locale-switcher.module.css";

const NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  nl: "Nederlands",
  es: "Español",
};

type KeyAction =
  | { type: "focus"; index: number }
  | { type: "select"; index: number }
  | { type: "close"; restoreFocus: boolean };

/** Shared keyboard decisions for the trigger and its single-select listbox. */
export function localeKeyAction(
  key: string,
  open: boolean,
  active: number,
  selected: number,
): KeyAction | null {
  if (key === "Escape")
    return open ? { type: "close", restoreFocus: true } : null;
  if (key === "Tab")
    return open ? { type: "close", restoreFocus: false } : null;
  if (key === "Enter" || key === " ")
    return open
      ? { type: "select", index: active }
      : { type: "focus", index: selected };
  if (key === "ArrowDown" || key === "ArrowUp")
    return {
      type: "focus",
      index: open
        ? (active + (key === "ArrowDown" ? 1 : -1) + locales.length) %
          locales.length
        : selected,
    };
  if (open && (key === "Home" || key === "End"))
    return { type: "focus", index: key === "Home" ? 0 : locales.length - 1 };
  return null;
}

export function LocaleSwitcher({ label }: { label: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const selected = Math.max(0, locales.indexOf(locale));
  const [active, setActive] = useState(selected);

  useEffect(() => {
    if (!open) return;
    options.current[active]?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, active]);

  function choose(index: number) {
    setOpen(false);
    trigger.current?.focus();
    if (locales[index] === locale) return;
    // Keep dynamic segments ([slug], [id]) when switching.
    router.replace(
      // @ts-expect-error -- pathname and params come from the current route.
      { pathname, params },
      { locale: locales[index] },
    );
  }

  return (
    <div
      className={styles.switcher}
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        const action = localeKeyAction(event.key, open, active, selected);
        if (!action) return;
        if (event.key !== "Tab") event.preventDefault();
        if (action.type === "focus") {
          setActive(action.index);
          setOpen(true);
        } else if (action.type === "select") choose(action.index);
        else {
          setOpen(false);
          if (action.restoreFocus) trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        id={`${id}-trigger`}
        className={styles.trigger}
        type="button"
        aria-label={`${label}: ${NAMES[locale]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => {
          setActive(selected);
          setOpen(!open);
        }}
      >
        <Globe size={17} aria-hidden="true" />
        <span lang={locale}>{NAMES[locale]}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={styles.list}
          role="listbox"
          id={`${id}-list`}
          aria-labelledby={`${id}-trigger`}
        >
          {locales.map((language, index) => (
            <button
              key={language}
              ref={(node) => {
                options.current[index] = node;
              }}
              className={styles.option}
              type="button"
              role="option"
              aria-selected={locale === language}
              lang={language}
              tabIndex={-1}
              onFocus={() => setActive(index)}
              onClick={() => choose(index)}
            >
              {NAMES[language]}
              {locale === language && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
