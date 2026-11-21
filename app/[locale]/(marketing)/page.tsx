// SPDX-License-Identifier: AGPL-3.0-only
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { FaqList } from "@/src/components/marketing/faq";
import { Cta } from "@/src/components/marketing/cta";
import { JsonLd } from "@/src/components/marketing/json-ld";
import {
  absoluteUrl,
  translatedMetadata,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import type { Faq } from "@/src/lib/content/seo";
export async function generateMetadata({ params }: LocaleProps) {
  return translatedMetadata(params, "home", "/");
}
export default async function Home({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const app = getAppConfig();
  if (!app.marketingEnabled) redirect("/sign-in");
  const t = await getTranslations("home");
  const f = await getTranslations("faqPage");
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
  return (
    <>
      <div className="container">
        <section className="hero">
          <div>
            <h1>{t("heading")}</h1>
            <p className="lead">{t("lead")}</p>
            <div className="row">
              <Link className="button" href="/sign-up">
                {t("start")}
              </Link>
              <Link className="button secondary" href="/how-it-works">
                {t("how")}
              </Link>
            </div>
          </div>
          <div className="hero-visual" role="img" aria-label={t("visual")}>
            <div className="row-between">
              <span className="badge accent">{t("example")}</span>
              <span className="mono tabular" aria-label={t("timer")}>
                42:18
              </span>
            </div>
            <div className="mock-tiles">
              {["alex", "sam"].map((person) => (
                <div className="mock-tile stack-sm" key={person}>
                  <span className="avatar lg" aria-hidden="true">
                    {person === "alex" ? "A" : "S"}
                  </span>
                  <strong>{t(person)}</strong>
                  <div className="mock-goal">{t(`${person}Goal`)}</div>
                </div>
              ))}
            </div>
            <div className="stack-sm">
              <strong>{t("focus")}</strong>
              <p className="small muted">{t("note")}</p>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="section-head">
            <h2>{t("stepsTitle")}</h2>
          </div>
          <div className="steps">
            {(t.raw("steps") as { title: string; body: string }[]).map(
              (step) => (
                <article className="card" key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              ),
            )}
          </div>
        </section>
        <section className="section">
          <div className="section-head">
            <h2>{t("featuresTitle")}</h2>
          </div>
          <div className="features">
            {(t.raw("features") as { title: string; body: string }[]).map(
              (feature) => (
                <article className="feature card" key={feature.title}>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ),
            )}
          </div>
        </section>
        <section className="section">
          <div className="section-head">
            <h2>{t("audienceTitle")}</h2>
          </div>
          <div className="audiences">
            {audiences.map(([key, href]) => (
              <Link className="chip" href={href} key={key}>
                {t(`audiences.${key}`)}
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className="band section">
        <div className="container stack">
          <h2>{t("sourceTitle")}</h2>
          <p className="lead">{t("sourceBody")}</p>
          <div>
            <a
              className="button secondary"
              href="https://github.com/gojayevmurad/focuskept"
            >
              {t("sourceLink")}
            </a>
          </div>
        </div>
      </section>
      <div className="container">
        <section className="section stack">
          <h2>{t("faqTitle")}</h2>
          <FaqList items={faqs} />
          <Link className="link" href="/faq">
            {t("allFaq")}
          </Link>
        </section>
        <Cta />
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": absoluteUrl("/#organization"),
              name: app.name,
              url: app.url,
              logo: absoluteUrl("/icon.svg"),
              email: app.supportEmail,
              sameAs: ["https://github.com/gojayevmurad/focuskept"],
            },
            {
              "@type": "WebSite",
              name: app.name,
              url: app.url,
              publisher: { "@id": absoluteUrl("/#organization") },
            },
          ],
        }}
      />
    </>
  );
}
