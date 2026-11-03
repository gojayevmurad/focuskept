import { isLocale } from "@/src/i18n/config";
import { getTechniqueContent } from "@/src/features/techniques/content";
import { slugFromPublic } from "@/src/features/techniques/slugs";
import { ogImage, OG_SIZE } from "@/src/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "FocusKept technique";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug: segment } = await params;
  const locale = isLocale(raw) ? raw : "en";
  const slug = slugFromPublic(segment);
  if (!slug) return ogImage({ locale, title: "", subtitle: "" });
  const c = (await getTechniqueContent(locale))[slug];
  return ogImage({ locale, title: c.name, subtitle: c.tagline });
}
