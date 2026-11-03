"use client";
import { useEffect, useState } from "react";

type Toast = { id: number; message: string; kind: "info" | "error" };
let listeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];
let nextId = 1;

function emit() {
  for (const listener of listeners) listener(toasts);
}

/** Shows a short, already-translated message in the polite live region. */
export function toast(message: string, kind: Toast["kind"] = "info") {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, kind }];
  emit();
  setTimeout(
    () => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
    kind === "error" ? 6000 : 3500,
  );
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
          {t.message}
        </div>
      ))}
    </div>
  );
}
