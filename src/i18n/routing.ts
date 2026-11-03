import { defineRouting } from "next-intl/routing";
import { defaultLocale, LOCALE_COOKIE, locales } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeCookie: { name: LOCALE_COOKIE, sameSite: "lax", maxAge: 31536000 },
  // hreflang alternates are emitted in page metadata (with x-default → /en), not as Link headers.
  alternateLinks: false,
});
