// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
export async function Cta({
  heading,
  body,
}: {
  heading?: string;
  body?: string;
}) {
  const t = await getTranslations("home");
  return (
    <section className="cta-band">
      <h2>{heading ?? t("ctaTitle")}</h2>
      <p>{body ?? t("ctaBody")}</p>
      <Link className="button" href="/sign-up">
        {t("start")}
      </Link>
    </section>
  );
}
