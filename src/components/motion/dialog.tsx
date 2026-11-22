// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import React, { useEffect, useRef, useCallback } from "react";

export interface DialogProps extends React.DialogHTMLAttributes<HTMLDialogElement> {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  closeOnBackdropClick?: boolean;
}

/**
 * A dialog component that uses the native HTML `<dialog>` element and `showModal()`.
 * Centered on desktop, bottom-sheet on mobile devices, with native focus trap,
 * Escape key to close, and animated backdrop.
 */
export function Dialog({
  open,
  onClose,
  children,
  className = "dialog",
  closeOnBackdropClick = true,
  ...rest
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open) {
      if (!el.open) {
        el.showModal();
      }
    } else {
      if (el.open) {
        el.close();
      }
    }
  }, [open]);

  const handleCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      onClose();
    },
    [onClose],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (closeOnBackdropClick && e.target === ref.current) {
        onClose();
      }
      rest.onClick?.(e);
    },
    [closeOnBackdropClick, onClose, rest],
  );

  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={handleCancel}
      onClose={onClose}
      onClick={handleClick}
      aria-modal="true"
      {...rest}
    >
      {children}
    </dialog>
  );
}

/**
 * Hook to manage dialog state and provide open/close handlers.
 */
export function useDialog(initialOpen = false) {
  const [isOpen, setIsOpen] = React.useState(initialOpen);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  };
}
