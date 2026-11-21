// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { useRouter } from "@/src/i18n/navigation";
import { authClient } from "@/src/lib/auth/client";
import { resetAnalytics } from "@/src/lib/analytics/client";

export function SignOut({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <button
      className={compact ? "button ghost small icon" : "button ghost small"}
      aria-label={t("signOut")}
      onClick={async () => {
        await authClient.signOut();
        resetAnalytics();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      <LogOut size={16} />
      {!compact && t("signOut")}
    </button>
  );
}
