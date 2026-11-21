import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/src/components/auth-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <>
      <h1>{t("resetTitle")}</h1>
      <Suspense>
        <AuthForm mode="reset-password" />
      </Suspense>
    </>
  );
}
