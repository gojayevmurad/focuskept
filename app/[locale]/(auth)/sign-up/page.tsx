import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/src/components/auth-page";
import {
  type LocaleParams,
  metadataLocale,
  resolveLocale,
} from "@/src/i18n/server";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("signUp"), robots: { index: false } };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ topic?: string }>;
}) {
  await resolveLocale(params);
  await connection();
  const t = await getTranslations("auth");
  const topic = (await searchParams).topic?.slice(0, 200);
  return (
    <AuthPage
      mode="sign-up"
      title={t("signUpTitle")}
      lead={t("signUpLead")}
      context={
        topic ? (
          <p className="notice mt-4">{t("learningContext", { topic })}</p>
        ) : undefined
      }
    />
  );
}
