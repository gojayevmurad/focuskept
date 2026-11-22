// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/src/components/auth-form";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <>
      <div className={`stack-sm ${styles.header}`}>
        <h1>{t("resetTitle")}</h1>
      </div>
      <Suspense>
        <AuthForm mode="reset-password" />
      </Suspense>
    </>
  );
}
