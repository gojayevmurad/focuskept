import "./globals.css";
import { getTranslations } from "next-intl/server";
import { defaultLocale } from "@/src/i18n/config";

// Rendered only for requests outside a locale segment (the proxy prefixes every
// page path), so it uses the default locale.
export default async function NotFound() {
  const t = await getTranslations({
    locale: defaultLocale,
    namespace: "errors",
  });
  return (
    <html lang={defaultLocale}>
      <body>
        <main
          className="empty"
          style={{ minHeight: "100dvh", justifyContent: "center" }}
        >
          <h1>{t("notFoundTitle")}</h1>
          <p>{t("notFoundText")}</p>
          <a className="btn btn-primary" href={`/${defaultLocale}`}>
            {t("backHome")}
          </a>
        </main>
      </body>
    </html>
  );
}
