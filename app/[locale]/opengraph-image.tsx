import { getTranslations } from "next-intl/server";
import { isLocale } from "@/src/i18n/config";
import { ogImage, OG_SIZE } from "@/src/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "FocusKept";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "en";
  const t = await getTranslations({ locale, namespace: "landing" });
  return ogImage({ locale, title: t("heroTitle"), subtitle: t("loop.title") });
}
