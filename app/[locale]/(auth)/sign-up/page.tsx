import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/src/components/auth-form";
import { getAppConfig } from "@/src/config/app";
import { getSession } from "@/src/lib/auth/session";
import { REFERRAL_COOKIE, getProfileByReferralCode } from "@/src/lib/profiles";
import { Link } from "@/src/i18n/navigation";

export const metadata: Metadata = { title: "Create your account" };

export default async function Page() {
  await connection();
  if ((await getSession())?.user.emailVerified) redirect("/dashboard");
  const t = await getTranslations("auth");
  const c = await getTranslations("common");
  const app = getAppConfig();
  let blocked: string | null = null;
  if (app.signupsMode === "closed") blocked = t("signupsClosed");
  if (app.signupsMode === "invite") {
    const code = (await cookies()).get(REFERRAL_COOKIE)?.value;
    if (!code || !(await getProfileByReferralCode(code)))
      blocked = t("inviteOnly", { app: app.name });
  }
  return (
    <>
      <div className="stack-sm">
        <h1>{t("signUpTitle")}</h1>
        <p className="muted">{app.billingEnabled ? t("signUpLead") : ""}</p>
      </div>
      {blocked ? (
        <>
          <p className="notice warn">{blocked}</p>
          <Link href="/sign-in" className="button secondary full">
            {c("signIn")}
          </Link>
        </>
      ) : (
        <Suspense>
          <AuthForm
            mode="sign-up"
            google={app.googleEnabled}
            appName={app.name}
          />
        </Suspense>
      )}
    </>
  );
}
