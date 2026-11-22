// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import {
  pageMetadata,
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import { getArticles, getTopics } from "@/src/lib/support/articles";
import { HelpClient } from "./help-client";

export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "help" });
  const app = getAppConfig();
  return pageMetadata(
    t("title", { app: app.name }),
    t("description"),
    "/help",
    locale,
  );
}

export default async function HelpPage({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const app = getAppConfig();
  const articles = getArticles(app.billingEnabled);
  const topics = getTopics(app.billingEnabled);

  return <HelpClient articles={articles} topics={topics} />;
}
