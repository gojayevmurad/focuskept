import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/src/components/auth-page";
import { redirectIfSignedIn } from "@/src/lib/auth/session";
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
  return { title: t("signIn"), robots: { index: false } };
}

export default async function Page({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<{ next?: string }> }) {
  await resolveLocale(params);
  // Rendered per request so the optional Google button reflects runtime config.
  await connection();
  await redirectIfSignedIn((await searchParams).next);
  const t = await getTranslations("auth");
  return (
    <AuthPage mode="sign-in" title={t("signInTitle")} lead={t("signInLead")} />
  );
}
