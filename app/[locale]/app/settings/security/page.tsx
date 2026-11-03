import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/src/components/page-header";
import { PasswordForm, Sessions } from "@/src/components/settings-form";
import { requireSession } from "@/src/lib/auth/session";
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
  return { title: t("security") };
}

export default async function Page({ params }: LocaleParams) {
  await resolveLocale(params);
  await requireSession("/app/settings/security");
  const t = await getTranslations("settings.security");
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          <Link href="/app/settings" className="btn btn-secondary btn-sm">
            {t("backToSettings")}
          </Link>
        }
      />
      <div className="stack">
        <section className="card stack">
          <h2 className="card-title">{t("passwordTitle")}</h2>
          <p className="muted small">{t("passwordText")}</p>
          <PasswordForm />
        </section>
        <section className="card stack">
          <h2 className="card-title">{t("sessionsTitle")}</h2>
          <p className="muted small">{t("sessionsText")}</p>
          <Sessions />
        </section>
      </div>
    </>
  );
}
