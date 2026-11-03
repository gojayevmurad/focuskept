import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientIntl } from "@/src/components/client-intl";
import { UnsubscribeButton } from "@/src/features/notifications/unsubscribe-button";
import { verifyUnsubscribe } from "@/src/features/notifications/tokens";
import { authSecret } from "@/src/config/env";
import { Link } from "@/src/i18n/navigation";
import {
  metadataLocale,
  resolveLocale,
  type LocaleParams,
} from "@/src/i18n/server";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({
    locale,
    namespace: "notifications.unsubscribe",
  });
  return { title: t("title"), robots: { index: false } };
}

export default async function Page({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<{ token?: string }> }) {
  await resolveLocale(params);
  const token = ((await searchParams).token ?? "").slice(0, 400);
  const claim = verifyUnsubscribe(authSecret(), token);
  const t = await getTranslations("notifications.unsubscribe");
  return (
    <div
      className="container-narrow"
      style={{ maxWidth: 520, paddingBlock: "64px" }}
    >
      <div className="card stack">
        <h1 className="text-2xl">{t("title")}</h1>
        {claim ? (
          <>
            <p className="muted">
              {t(claim.category === "reviews" ? "reviews" : "weekly")}
            </p>
            <ClientIntl namespaces={["notifications"]}>
              <UnsubscribeButton token={token} />
            </ClientIntl>
          </>
        ) : (
          <p className="notice notice-danger">{t("invalid")}</p>
        )}
        <p className="small">
          <Link className="link" href="/app/settings">
            {t("settings")}
          </Link>
        </p>
      </div>
    </div>
  );
}
