import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
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
  return { title: t("verifyEmail"), robots: { index: false } };
}

export default async function Page({ params }: LocaleParams) {
  await resolveLocale(params);
  const t = await getTranslations("auth");
  return (
    <div className="card stack text-center items-center">
      <MailCheck size={36} className="text-accent" aria-hidden="true" />
      <h1 className="text-2xl">{t("verifyTitle")}</h1>
      <p className="muted">{t("verifyLead")}</p>
      <p className="tiny muted">{t("verifyHint")}</p>
      <Link href="/sign-in" className="btn btn-secondary">
        {t("signInLink")}
      </Link>
    </div>
  );
}
