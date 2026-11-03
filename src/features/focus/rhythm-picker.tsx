"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import type { TimeTechnique } from "@/src/features/techniques/slugs";
import { Link } from "@/src/i18n/navigation";
import type { TechniqueLabels } from "./labels";

export type RhythmOption = {
  slug: TimeTechnique;
  meta: string;
};

/** One Rhythm control: a button that opens a bottom sheet / popover list. */
export function RhythmPicker({
  value,
  meta,
  options,
  labels,
  open,
  onOpenChange,
  onChange,
}: {
  value: TimeTechnique;
  meta: string;
  options: RhythmOption[];
  labels: TechniqueLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: TimeTechnique) => void;
}) {
  const t = useTranslations("home");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="rhythm-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(true)}
      >
        <span className="rhythm-button-text">
          <span className="rhythm-button-label">{t("rhythm")}</span>
          <span className="rhythm-button-value">{labels[value]?.name}</span>
        </span>
        <span className="rhythm-meta ltr-island">{meta}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={ref}
        className="sheet"
        aria-labelledby="rhythm-title"
        onClose={() => onOpenChange(false)}
        onCancel={(e) => {
          e.preventDefault();
          onOpenChange(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        {open && (
          <div className="sheet-body">
            <span className="sheet-grip" aria-hidden="true" />
            <div className="sheet-head">
              <h2 id="rhythm-title">{t("rhythm")}</h2>
              <span>{t("rhythmHint")}</span>
            </div>
            <div role="radiogroup" aria-labelledby="rhythm-title">
              {options.map((option) => {
                const selected = option.slug === value;
                return (
                  <button
                    key={option.slug}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className="sheet-option"
                    onClick={() => {
                      onChange(option.slug);
                      onOpenChange(false);
                    }}
                  >
                    <span className="sheet-option-text">
                      <span className="sheet-option-title">
                        {labels[option.slug]?.name}
                      </span>
                      <span className="sheet-option-sub">
                        {t(`rhythmSub.${option.slug}`)}
                      </span>
                    </span>
                    <span className="rhythm-meta ltr-island">
                      {option.meta}
                    </span>
                    <span className="sheet-check" aria-hidden="true">
                      {selected && <Check size={13} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <Link href="/techniques" className="link sheet-link">
              {t("rhythmGuide")}
            </Link>
          </div>
        )}
      </dialog>
    </>
  );
}
