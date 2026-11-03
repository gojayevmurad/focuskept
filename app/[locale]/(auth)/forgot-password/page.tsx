import type { Metadata } from "next";
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
  return { title: t("forgotPassword"), robots: { index: false } };
}

export default async function Page({ params }: LocaleParams) {
  await resolveLocale(params);
  const t = await getTranslations("auth");
  return (
    <AuthPage
      mode="forgot-password"
      title={t("forgotTitle")}
      lead={t("forgotLead")}
    />
  );
}
