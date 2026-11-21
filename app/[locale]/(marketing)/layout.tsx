// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/src/components/site-header";
import { SiteFooter } from "@/src/components/site-footer";
import type { LocaleProps } from "@/src/lib/content/marketing";
export default async function MarketingLayout({
  children,
  params,
}: LocaleProps & { children: React.ReactNode }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  return (
    <div className="marketing-shell">
      <a className="sr-only focus:not-sr-only" href="#main-content">
        {t("skip")}
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}
