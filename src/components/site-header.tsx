// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { getSession } from "@/src/lib/auth/session";
import { Link } from "@/src/i18n/navigation";
import { Logo } from "./logo";
import { SourceCode } from "./marketing/source-code";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const t = await getTranslations("site");
  const c = await getTranslations("common");
  const app = getAppConfig();
  const session = await getSession().catch(() => null);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Logo name={app.name} logoUrl={app.logoUrl} />
        <nav aria-label={app.name}>
          {app.marketingEnabled && (
            <>
              <Link href="/how-it-works">{t("how")}</Link>
              {app.billingEnabled && (
                <Link href="/pricing">{t("pricing")}</Link>
              )}
              <Link href="/faq">{t("faq")}</Link>
              <Link href="/blog">{t("blog")}</Link>
            </>
          )}
        </nav>
        <div className="header-actions">
          <SourceCode
            url={app.repoUrl}
            label={t("source")}
            comingSoon={t("sourceComingSoon")}
            iconOnly
          />
          <ThemeToggle />
          {session ? (
            <Link href="/dashboard" className="button small">
              {c("dashboard")}
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="button ghost small">
                {c("signIn")}
              </Link>
              <Link href="/sign-up" className="button small">
                {c("getStarted")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
