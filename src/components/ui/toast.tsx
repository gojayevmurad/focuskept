"use client";
import { useEffect, useState } from "react";

type Action = { label: string; onClick: () => void };
type Toast = {
  id: number;
  message: string;
  kind: "info" | "error";
  action?: Action;
};
let listeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];
let nextId = 1;

function emit() {
  for (const listener of listeners) listener(toasts);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/**
 * Shows a short, already-translated message in the polite live region.
 * With an action (e.g. Undo) it stays for `ms`, which should match how long
 * the action can still be taken.
 */
export function toast(
  message: string,
  kind: Toast["kind"] = "info",
  options: { action?: Action; ms?: number } = {},
) {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, kind, action: options.action }];
  emit();
  setTimeout(() => dismiss(id), options.ms ?? (kind === "error" ? 6000 : 3500));
  return () => dismiss(id);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={t.kind === "error" ? "toast toast-error" : "toast"}
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                t.action?.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
