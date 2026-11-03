import "server-only";
import type { Locale } from "@/src/i18n/config";
import type english from "@/content/legal/en.json";

export type LegalContent = typeof english;
export type LegalDocument = LegalContent["privacy"];

export async function getLegalContent(locale: Locale): Promise<LegalContent> {
  if (locale !== "en") {
    try {
      return (await import(`@/content/legal/${locale}.json`))
        .default as LegalContent;
    } catch {}
  }
  return (await import("@/content/legal/en.json")).default as LegalContent;
}
