"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRealtime } from "@/src/lib/realtime/client";

/** Refreshes server components when the user's bookings change elsewhere. */
export function RealtimeRefresh({ userId }: { userId: string }) {
  const router = useRouter();
  const t = useTranslations("realtime");
  const [toast, setToast] = useState("");
  useRealtime(
    (message) => {
      if (message.topic !== `user:${userId}`) return;
      if (message.event === "booking.matched") setToast(t("matched"));
      if (message.event === "booking.partner_changed")
        setToast(t("partnerChanged"));
      if (message.event === "booking.fallback") setToast(t("fallback"));
      router.refresh();
      if (message.event !== "booking.updated")
        setTimeout(() => setToast(""), 6000);
    },
    { onReconnect: () => router.refresh() },
  );
  return toast ? (
    <div className="toast" role="status">
      {toast}
    </div>
  ) : null;
}
