"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BellRing } from "lucide-react";
import { useHydrated } from "@/src/lib/use-hydrated";

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

/** Subscribes this browser to review reminders (Web Push / VAPID). */
export async function subscribeToPush(vapidPublicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const registration =
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToBytes(vapidPublicKey),
    }));
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  return response.ok;
}

export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe();
}

export function PushOptIn({
  vapidPublicKey,
  variant = "card",
}: {
  vapidPublicKey?: string;
  variant?: "card" | "inline";
}) {
  const hydrated = useHydrated();
  const t = useTranslations("notifications.push");
  const [state, setState] = useState<"idle" | "busy" | "done" | "denied">(
    "idle",
  );
  if (!hydrated || !vapidPublicKey || !pushSupported()) return null;
  if (variant === "card" && Notification.permission === "denied") return null;
  const button = (
    <button
      className="btn btn-secondary btn-sm"
      disabled={state === "busy" || state === "done"}
      onClick={async () => {
        setState("busy");
        try {
          setState((await subscribeToPush(vapidPublicKey)) ? "done" : "denied");
        } catch {
          setState("denied");
        }
      }}
    >
      <BellRing size={15} aria-hidden="true" />
      {state === "done" ? t("enabled") : t("enable")}
    </button>
  );
  if (variant === "inline")
    return (
      <div className="stack" style={{ gap: 6 }}>
        <div>{button}</div>
        {state === "denied" && <p className="hint">{t("denied")}</p>}
      </div>
    );
  return (
    <aside className="card stack" style={{ gap: 10 }}>
      <h2 className="card-title">{t("question")}</h2>
      <p className="small muted">{t("text")}</p>
      <div>{button}</div>
      {state === "denied" && <p className="hint">{t("denied")}</p>}
    </aside>
  );
}
