// SPDX-License-Identifier: AGPL-3.0-only
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { getEnv } from "@/src/config/env";
import { Link } from "@/src/i18n/navigation";
import { FaqList } from "@/src/components/marketing/faq";
import {
  Cta,
  SessionTimeline,
  getLanesTranslations,
} from "@/src/components/marketing/cta";
import { BookingLink, PoolDemo } from "@/src/components/marketing/pool-demo";
import { ArrowUpRight } from "lucide-react";
import { BOOKING_CUTOFF_MIN, SLOT_MINUTES } from "@/src/lib/scheduling/slots";
import styles from "./landing.module.css";
import marketing from "@/src/components/marketing/marketing.module.css";
import { JsonLd } from "@/src/components/marketing/json-ld";
import {
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import type { Faq } from "@/src/lib/content/seo";
import {
  buildGraph,
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildWebApplicationSchema,
  buildFaqSchema,
} from "@/src/lib/seo/schema";

export async function generateMetadata({ params }: LocaleProps) {
  return translatedMetadata(params, "home", "/");
}

export default async function Home({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const app = getAppConfig();
  if (!app.marketingEnabled) redirect("/sign-in");
  const [t, f, lanes] = await Promise.all([
    getTranslations("home"),
    getTranslations("faqPage"),
    getLanesTranslations(),
  ]);
  const groups = f.raw("groups") as { title: string; items: Faq[] }[];
  const faqs = [
    groups[0].items[0],
    groups[1].items[0],
    groups[1].items[2],
    groups[2].items[0],
    groups[3].items[0],
  ];
  const audiences = [
    ["adhd", "/body-doubling-for/adhd"],
    ["students", "/body-doubling-for/students"],
    ["bar", "/study-with-me/bar-exam"],
    ["mcat", "/study-with-me/mcat"],
    ["writers", "/body-doubling-for/writers"],
    ["developers", "/virtual-coworking-for/software-engineers"],
    ["freelancers", "/body-doubling-for/freelancers"],
    ["founders", "/body-doubling-for/founders"],
    ["remote", "/body-doubling-for/remote-workers"],
    ["researchers", "/body-doubling-for/researchers"],
  ];

  const env = getEnv();
  const socialProfiles = (env.SOCIAL_PROFILES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <>
      <div className={styles.landing}>
        <div className={styles.tileGround}>
          <div className="container">
            <section className={styles.hero}>
              <div className={styles.heroCopy}>
                <h1>{lanes("lanes.heading")}</h1>
                <p>{lanes("lanes.lead")}</p>
                <div className={styles.heroActions}>
                  <BookingLink
                    label={lanes("lanes.book")}
                    nextLabel={lanes.raw("lanes.bookNext") as string}
                    locale={locale}
                    cutoffMinutes={BOOKING_CUTOFF_MIN}
                    slotMinutes={SLOT_MINUTES}
                  />
                  <Link className={styles.quietLink} href="/how-it-works">
                    {t("how")}
                  </Link>
                </div>
                {!app.billingEnabled && (
                  <p className={styles.earlyAccess}>{f("earlyAccess.a")}</p>
                )}
              </div>
              <PoolDemo
                locale={locale}
                copy={{
                  label: t("visual"),
                  example: t("example"),
                  note: t("note"),
                  timer: t("timer"),
                  minutesLeft: lanes.raw("lanes.minutesLeft") as string,
                  preview: lanes("lanes.preview"),
                  pause: lanes("lanes.pause"),
                  resume: lanes("lanes.resume"),
                  intro: lanes("lanes.intro"),
                  focus: lanes("lanes.focus"),
                  wrap: lanes("lanes.wrap"),
                  people: [
                    { name: t("alex"), goal: t("alexGoal") },
                    { name: t("sam"), goal: t("samGoal") },
                  ],
                }}
              />
            </section>
          </div>
        </div>
        <div className="container">
          <SessionTimeline />
          <section className={styles.audienceSection}>
            <h2>{t("audienceTitle")}</h2>
            <ul className={styles.schedule}>
              {audiences.map(([key, href], index) => (
                <li key={key}>
                  <Link href={href}>
                    <span className={styles.scheduleNumber} aria-hidden="true">
                      {new Intl.NumberFormat(locale, {
                        minimumIntegerDigits: 2,
                      }).format(index + 1)}
                    </span>
                    <span>{t(`audiences.${key}`)}</span>
                    <ArrowUpRight size={19} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.featuresSection}>
            <h2>{t("featuresTitle")}</h2>
            <dl className={styles.features}>
              {(t.raw("features") as { title: string; body: string }[]).map(
                (feature) => (
                  <div key={feature.title}>
                    <dt>{feature.title}</dt>
                    <dd>{feature.body}</dd>
                  </div>
                ),
              )}
            </dl>
          </section>
          <div className={styles.freePlan}>
            <p>{lanes("lanes.freePlan", { count: app.freeWeeklySessions })}</p>
            <Link href="/sign-up">
              {t("start")}
              <ArrowUpRight size={20} aria-hidden="true" />
            </Link>
          </div>
          <section className={styles.sourceSection}>
            <h2>{t("sourceTitle")}</h2>
            <div>
              <p>{t("sourceBody")}</p>
              <a href="https://github.com/gojayevmurad/focuskept">
                {t("sourceLink")}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
          </section>
          <section className={marketing.section}>
            <h2>{t("faqTitle")}</h2>
            <FaqList items={faqs} />
            <Link className={styles.quietLink} href="/faq">
              {t("allFaq")}
            </Link>
          </section>
          <Cta />
        </div>
      </div>
      <JsonLd
        data={buildGraph([
          buildOrganizationSchema(app, socialProfiles),
          buildWebSiteSchema(app),
          buildWebApplicationSchema(app),
          buildFaqSchema(faqs),
        ])}
      />
    </>
  );
}
