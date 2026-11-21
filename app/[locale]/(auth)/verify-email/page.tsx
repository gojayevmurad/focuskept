// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";

export const metadata: Metadata = {
  title: "Check your inbox",
  robots: { index: false },
};

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <>
      <MailCheck size={34} color="var(--accent)" />
      <h1>{t("verifyTitle")}</h1>
      <p className="muted">{t("verifyLead")}</p>
      <Link href="/sign-in" className="button full">
        {t("continueSignIn")}
      </Link>
    </>
  );
}
