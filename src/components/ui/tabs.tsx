"use client";
import { useRef } from "react";

/** Accessible tabs with roving focus (arrow keys follow reading direction). */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string }[];
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      className="tabs"
      role="tablist"
      aria-label={label}
      ref={ref}
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        const index = items.findIndex((i) => i.value === value);
        let next = index;
        if (e.key === "Home") next = 0;
        else if (e.key === "End") next = items.length - 1;
        else {
          const forward = (e.key === "ArrowRight") !== rtl;
          next = (index + (forward ? 1 : -1) + items.length) % items.length;
        }
        e.preventDefault();
        onChange(items[next].value);
        ref.current
          ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
          [next]?.focus();
      }}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          tabIndex={item.value === value ? 0 : -1}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
