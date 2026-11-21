"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/src/lib/analytics/client";
export function BillingButton({
  plan,
  portal = false,
}: {
  plan?: "monthly" | "yearly" | "lifetime";
  portal?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="button full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch(
              `/api/billing/${portal ? "portal" : "checkout"}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
              },
            );
            const data = await response.json();
            if (response.status === 401) {
              router.push("/sign-in");
              return;
            }
            if (!response.ok) throw new Error(data.error);
            if (!portal) track("checkout_started", { plan });
            location.assign(data.url);
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Unable to connect");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Connecting…"
          : portal
            ? "Manage billing & cancellation"
            : "Choose this plan"}
      </button>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}
