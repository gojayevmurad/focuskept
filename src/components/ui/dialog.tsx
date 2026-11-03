"use client";
import { useEffect, useRef } from "react";

/** Native modal <dialog>: focus trapping, Esc and inert background come from the platform. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  labelledBy,
  label,
  variant = "dialog",
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  labelledBy?: string;
  /** Accessible name when there is no visible title. */
  label?: string;
  /** "sheet": bottom sheet on phones, centred panel on larger screens. */
  variant?: "dialog" | "sheet";
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`${variant}${wide ? " dialog-wide" : ""}`}
      aria-labelledby={labelledBy}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={variant === "sheet" ? "sheet-body" : "dialog-body"}>
          {variant === "sheet" && (
            <span className="sheet-grip" aria-hidden="true" />
          )}
          {title && (
            <h2 id={labelledBy} className="card-title">
              {title}
            </h2>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
