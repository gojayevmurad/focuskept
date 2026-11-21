import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/src/components/auth-form";
import { getAppConfig } from "@/src/config/app";
import { getSession } from "@/src/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function Page() {
  await connection();
  if ((await getSession())?.user.emailVerified) redirect("/dashboard");
  const t = await getTranslations("auth");
  const app = getAppConfig();
  return (
    <>
      <div className="stack-sm">
        <h1>{t("signInTitle")}</h1>
        <p className="muted">{t("signInLead")}</p>
      </div>
      <Suspense>
        <AuthForm mode="sign-in" google={app.googleEnabled} appName={app.name} />
      </Suspense>
    </>
  );
}
