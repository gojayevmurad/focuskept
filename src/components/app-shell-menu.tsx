// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import styles from "./app-shell.module.css";

export function AppShellMenu({
  label,
  closeLabel,
  children,
}: {
  label: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 761px)");
    const close = () => {
      if (desktop.matches) dialog.current?.close();
    };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);
  return (
    <>
      <button
        type="button"
        className={styles.menuButton}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <Menu size={20} aria-hidden="true" />
        <span>{label}</span>
      </button>
      <dialog
        ref={dialog}
        className={styles.mobileDialog}
        aria-label={label}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]"))
            dialog.current?.close();
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            dialog.current?.close();
        }}
      >
        <div className={styles.menuHeading}>
          <strong>{label}</strong>
          <button
            type="button"
            className="button ghost icon"
            aria-label={closeLabel}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}
