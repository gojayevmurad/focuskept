import "../globals.css";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/src/i18n/routing";
import { direction, locales } from "@/src/i18n/config";
import { CjkFont, fontClassName } from "@/src/i18n/fonts";
import { ClientIntl } from "@/src/components/client-intl";
import { SkipLink } from "@/src/components/skip-link";
import { ConsentBanner } from "@/src/components/consent";
import { Toaster } from "@/src/components/ui/toast";
import { ServiceWorker } from "@/src/components/service-worker";
import { appUrl } from "@/src/lib/site";
import { brand } from "@/src/config/brand";
import { ThemeBoot } from "@/src/components/theme-boot";
import { ThemeSync } from "@/src/components/theme-sync";
import { HydrationMark } from "@/src/components/hydration-mark";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(appUrl()),
    title: { default: t("defaultTitle"), template: `%s · ${brand.name}` },
    description: t("defaultDescription"),
    applicationName: brand.name,
    authors: [{ name: brand.name, url: appUrl() }],
    creator: brand.name,
    publisher: brand.name,
    category: "productivity",
    referrer: "strict-origin-when-cross-origin",
    manifest: "/manifest.webmanifest",
    // The browser-tab icon: SVG for modern browsers, PNG and .ico fallbacks.
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    verification: siteVerification(),
    appleWebApp: {
      capable: true,
      title: brand.name,
      statusBarStyle: "black-translucent",
    },
    formatDetection: { telephone: false, email: false, address: false },
    other: { "msapplication-TileColor": "#0E1110" },
  };
}

/** Search Console / Bing / Yandex ownership tags, set at build time when known. */
function siteVerification(): Metadata["verification"] {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;
  const yandex = process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION;
  if (!google && !bing && !yandex) return undefined;
  return {
    google,
    yandex,
    other: bing ? { "msvalidate.01": bing } : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e1110" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1110" },
  ],
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html
      lang={locale}
      dir={direction(locale)}
      className={fontClassName(locale)}
      suppressHydrationWarning
    >
      <body>
        <CjkFont locale={locale} />
        {/* data-theme is never rendered by React, so re-renders (e.g.
            switching language) can't reset it. */}
        <ThemeBoot />
        <ThemeSync />
        <HydrationMark />
        <SkipLink />
        <ClientIntl namespaces={["errors"]}>
          {children}
          <ConsentBanner />
          <Toaster />
          <ServiceWorker />
        </ClientIntl>
      </body>
    </html>
  );
}
