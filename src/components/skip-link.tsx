import { getTranslations } from "next-intl/server";

/** First focusable element: jumps keyboard users past the navigation. */
export async function SkipLink() {
  const t = await getTranslations("common.nav");
  return (
    <a href="#main" className="skip-link">
      {t("skipToContent")}
    </a>
  );
}
