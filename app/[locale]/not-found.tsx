import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main
      className="empty"
      style={{ minHeight: "70dvh", justifyContent: "center" }}
    >
      <h1>{t("notFoundTitle")}</h1>
      <p>{t("notFoundText")}</p>
      <Link className="btn btn-primary" href="/">
        {t("backHome")}
      </Link>
    </main>
  );
}
