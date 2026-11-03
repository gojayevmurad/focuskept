import { SiteHeader } from "@/src/components/site-header";
import { SiteFooter } from "@/src/components/site-footer";
import { resolveLocale, type LocaleParams } from "@/src/i18n/server";

export default async function PublicLayout({
  children,
  params,
}: LocaleParams & { children: React.ReactNode }) {
  // Every layout that translates must set the locale for static rendering.
  await resolveLocale(params);
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
