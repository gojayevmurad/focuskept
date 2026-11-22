// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Figtree } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { routing } from "@/src/i18n/routing";
import { getAppConfig } from "@/src/config/app";
import { ConsentBanner } from "@/src/components/consent";
import { AnalyticsProvider } from "@/src/lib/analytics/provider";
import { Verification } from "@/src/components/seo/verification";

const display = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
const sans = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// Pages render per request so one image serves any APP_NAME, APP_URL and
// feature flags set at runtime. Put a CDN in front for public pages.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const app = getAppConfig();
  return {
    metadataBase: new URL(app.url),
    title: {
      default: t("title", { app: app.name }),
      template: `%s · ${app.name}`,
    },
    description: t("description"),
    applicationName: app.name,
    manifest: "/manifest.webmanifest",
    openGraph: { siteName: app.name, type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#081c2a" },
  ],
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
  const app = getAppConfig();
  return (
    <html
      lang={locale}
      className={`${sans.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Verification />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        <NextIntlClientProvider>
          <AnalyticsProvider config={app.analytics}>
            {children}
            {app.analytics.enabled && <ConsentBanner />}
          </AnalyticsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
