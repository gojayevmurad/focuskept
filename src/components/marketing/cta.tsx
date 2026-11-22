// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import styles from "./marketing.module.css";

/** Uses translated Lanes copy as it becomes available in each locale. */
export async function getLanesTranslations() {
  const t = await getTranslations("home");
  return t.has("lanes.heading")
    ? t
    : getTranslations({ locale: "en", namespace: "home" });
}

export async function SessionTimeline() {
  const [home, room, common, lanes] = await Promise.all([
    getTranslations("home"),
    getTranslations("room"),
    getTranslations("common"),
    getLanesTranslations(),
  ]);
  const steps = home.raw("steps") as { title: string; body: string }[];
  const phases = [
    { key: "intro", from: 0, to: 3, body: steps[1].body },
    { key: "focus", from: 3, to: 47, body: steps[2].body },
    { key: "wrap", from: 47, to: 50, body: room("tipsBody.wrap") },
  ];
  return (
    <section className={styles.timelineSection}>
      <div className={styles.timelineHeading}>
        <h2>{lanes("lanes.sessionTitle")}</h2>
        <span>{common("minutes", { count: 50 })}</span>
      </div>
      <p className={styles.timelineBooking}>
        <strong>{steps[0].title}.</strong> {steps[0].body}
      </p>
      <div className={styles.sessionTrack} aria-hidden="true">
        {phases.map((phase) => (
          <span key={phase.key} data-phase={phase.key} />
        ))}
      </div>
      <ol className={styles.timelineCopy}>
        {phases.map((phase) => (
          <li key={phase.key}>
            <span className={styles.minuteMark}>
              {lanes("lanes.minuteMark", { from: phase.from, to: phase.to })}
            </span>
            <h3>{lanes(`lanes.${phase.key}`)}</h3>
            <p>{phase.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export async function Cta({
  heading,
  body,
}: {
  heading?: string;
  body?: string;
}) {
  const t = await getTranslations("home");
  return (
    <section className={styles.cta}>
      <div className={styles.ctaCopy}>
        <h2>{heading ?? t("ctaTitle")}</h2>
        <p>{body ?? t("ctaBody")}</p>
        <Link className={`button ${styles.bookingButton}`} href="/sign-up">
          {t("start")}
        </Link>
      </div>
    </section>
  );
}
