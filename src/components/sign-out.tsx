"use client";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { authClient } from "@/src/lib/auth/client";
import { resetAnalytics } from "@/src/lib/analytics/client";

export function SignOut({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("common");
  return (
    <button
      className={compact ? "button ghost small icon" : "button ghost small"}
      aria-label={t("signOut")}
      onClick={async () => {
        await authClient.signOut();
        resetAnalytics();
        location.assign("/sign-in");
      }}
    >
      <LogOut size={16} />
      {!compact && t("signOut")}
    </button>
  );
}
