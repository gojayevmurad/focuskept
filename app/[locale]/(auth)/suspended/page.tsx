// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { SignOut } from "@/src/components/sign-out";

export const metadata: Metadata = {
  title: "Account paused",
  robots: { index: false },
};

export default async function Page() {
  const t = await getTranslations("auth");
  const app = getAppConfig();
  return (
    <>
      <h1>{t("suspendedTitle")}</h1>
      <p className="muted">{t("suspendedLead", { email: app.supportEmail })}</p>
      <SignOut />
    </>
  );
}
