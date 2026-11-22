// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/src/components/auth-form";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false },
};

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <>
      <div className={`stack-sm ${styles.header}`}>
        <h1>{t("forgotTitle")}</h1>
        <p className={`muted ${styles.lead}`}>{t("forgotLead")}</p>
      </div>
      <Suspense>
        <AuthForm mode="forgot-password" />
      </Suspense>
    </>
  );
}
