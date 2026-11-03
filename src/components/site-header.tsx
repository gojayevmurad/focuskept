import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { Logo } from "./logo";
import { SiteMenu } from "./site-menu";

export async function SiteHeader() {
  const t = await getTranslations("common.nav");
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="logo">
          <Logo />
        </Link>
        <div className="header-actions">
          <SiteMenu />
          <Link href="/sign-in" className="btn btn-secondary btn-sm">
            {t("signIn")}
          </Link>
        </div>
      </div>
    </header>
  );
}
