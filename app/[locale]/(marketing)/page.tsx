// SPDX-License-Identifier: AGPL-3.0-only
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { getEnv } from "@/src/config/env";
import { Link } from "@/src/i18n/navigation";
import { FaqList } from "@/src/components/marketing/faq";
import { Cta } from "@/src/components/marketing/cta";
import { BookingLink } from "@/src/components/marketing/pool-demo";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Heart,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { GithubIcon } from "@/src/components/marketing/github-icon";
import { SessionPreview } from "@/src/components/marketing/session-preview";
import { SourceCode } from "@/src/components/marketing/source-code";
import { BOOKING_CUTOFF_MIN, SLOT_MINUTES } from "@/src/lib/scheduling/slots";
import styles from "./landing.module.css";
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
  const [t, f] = await Promise.all([
    getTranslations("home"),
    getTranslations("faqPage"),
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
        <div className={styles.container}>
          <section className={styles.hero} aria-labelledby="hero-title">
            <div className={styles.heroCopy}>
              <p className={styles.intro}>
                <span aria-hidden="true" />
                {t("bodyDoubling")}
              </p>
              <h1 id="hero-title">{t("heading")}</h1>
              <p className={styles.lead}>{t("lead")}</p>
              <div className={styles.heroActions}>
                <BookingLink
                  label={t("bookFirst")}
                  nextLabel={t.raw("nextSlot") as string}
                  locale={locale}
                  cutoffMinutes={BOOKING_CUTOFF_MIN}
                  slotMinutes={SLOT_MINUTES}
                />
                <Link className={styles.quietLink} href="/how-it-works">
                  {t("how")}
                </Link>
              </div>
              {!app.billingEnabled && (
                <p className={styles.earlyAccess}>
                  {f("earlyAccess.a", { app: app.name })}
                </p>
              )}
            </div>
            <SessionPreview
              copy={{
                label: t("visual"),
                example: t("example"),
                focus: t("focus"),
                timer: t("timer"),
                note: t("note"),
                partner: t("alex"),
                you: t("previewYou"),
                goals: t("sharedGoals"),
                partnerGoal: t("alexGoal"),
                yourGoal: t("samGoal"),
                duration: t("previewDuration"),
              }}
            />
          </section>
          <ul className={styles.trust} aria-label={t("trustLabel")}>
            {!app.billingEnabled && (
              <li>
                <Check size={18} aria-hidden="true" />
                {t("trust.free")}
              </li>
            )}
            <li>
              <GithubIcon size={18} />
              {t("trust.source")}
            </li>
            <li>
              <ShieldCheck size={18} aria-hidden="true" />
              {t("trust.recording")}
            </li>
            <li>
              <Video size={18} aria-hidden="true" />
              {t("trust.camera")}
            </li>
          </ul>
          <section className={styles.section} aria-labelledby="steps-title">
            <div className={styles.sectionHead}>
              <h2 id="steps-title">{t("stepsTitle")}</h2>
              <p>{t("stepsLead")}</p>
            </div>
            <ol className={styles.steps}>
              {(t.raw("steps") as { title: string; body: string }[]).map(
                (step, index) => (
                  <li key={step.title}>
                    <div
                      className={styles.stepIllustration}
                      data-step={index}
                      aria-hidden="true"
                    >
                      <span />
                      <span />
                      <i />
                    </div>
                    <span className={styles.stepNumber}>
                      {new Intl.NumberFormat(locale, {
                        minimumIntegerDigits: 2,
                      }).format(index + 1)}
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </li>
                ),
              )}
            </ol>
          </section>
          <section
            className={`${styles.section} ${styles.why}`}
            aria-labelledby="why-title"
          >
            <div>
              <h2 id="why-title">{t("whyTitle")}</h2>
              <p className={styles.whyLead}>{t("whyLead")}</p>
              <Link className={styles.quietLink} href="/how-it-works">
                {t("how")}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.whyReasons}>
              {(t.raw("whyReasons") as { title: string; body: string }[]).map(
                (reason) => (
                  <div key={reason.title}>
                    <h3>{reason.title}</h3>
                    <p>{reason.body}</p>
                  </div>
                ),
              )}
            </div>
          </section>
          <section className={styles.section} aria-labelledby="timeline-title">
            <div className={styles.sectionHead}>
              <h2 id="timeline-title">{t("timelineTitle")}</h2>
              <p>{t("timelineLead")}</p>
            </div>
            <ol className={styles.timeline}>
              {(
                t.raw("timeline") as {
                  time: string;
                  title: string;
                  body: string;
                }[]
              ).map((step) => (
                <li key={step.title}>
                  <span className={styles.time}>{step.time}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>
          <section className={styles.section} aria-labelledby="features-title">
            <div className={styles.sectionHead}>
              <h2 id="features-title">{t("featuresTitle")}</h2>
            </div>
            <div className={styles.features}>
              {(t.raw("features") as { title: string; body: string }[]).map(
                (feature, index) => {
                  const Icon = [
                    Users,
                    Heart,
                    Clock3,
                    CalendarDays,
                    ShieldCheck,
                    Video,
                  ][index];
                  return (
                    <article key={feature.title}>
                      <Icon size={22} aria-hidden="true" />
                      <h3>{feature.title}</h3>
                      <p>{feature.body}</p>
                    </article>
                  );
                },
              )}
            </div>
          </section>
          <section
            className={`${styles.section} ${styles.audiences}`}
            aria-labelledby="audiences-title"
          >
            <h2 id="audiences-title">{t("audienceTitle")}</h2>
            <ul>
              {audiences.map(([key, href]) => (
                <li key={key}>
                  <Link href={href}>
                    {t(`audiences.${key}`)}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section
            className={`${styles.section} ${styles.sourceSection}`}
            aria-labelledby="source-title"
          >
            <h2 id="source-title">{t("sourceTitle")}</h2>
            <div>
              <p>{t("sourceBody")}</p>
              <SourceCode
                url={app.repoUrl}
                label={t("sourceLink")}
                comingSoon={t("sourceComingSoon")}
              />
            </div>
          </section>
          {app.billingEnabled && (
            <p className={styles.freePlan}>
              {t("lanes.freePlan", { count: app.freeWeeklySessions })}
            </p>
          )}
          <section
            className={`${styles.section} ${styles.faq}`}
            aria-labelledby="faq-title"
          >
            <div>
              <h2 id="faq-title">{t("faqTitle")}</h2>
              <Link className={styles.quietLink} href="/faq">
                {t("allFaq")}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <FaqList items={faqs} />
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
