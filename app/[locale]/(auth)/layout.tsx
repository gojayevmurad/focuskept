import { SiteHeader } from "@/src/components/site-header";
import { ClientIntl } from "@/src/components/client-intl";
import { resolveLocale, type LocaleParams } from "@/src/i18n/server";

export default async function AuthLayout({
  children,
  params,
}: LocaleParams & { children: React.ReactNode }) {
  await resolveLocale(params);
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="container-narrow"
        style={{ maxWidth: 460, paddingBlock: "48px 64px" }}
      >
        <ClientIntl namespaces={["auth"]}>{children}</ClientIntl>
      </main>
    </>
  );
}
