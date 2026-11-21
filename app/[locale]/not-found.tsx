import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="empty-state">
      <span className="overline">404</span>
      <h1>{t("notFound")}</h1>
      <Link href="/" className="button">
        {t("home")}
      </Link>
    </main>
  );
}
