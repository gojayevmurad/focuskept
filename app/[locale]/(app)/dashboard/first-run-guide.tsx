// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import React, { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  CalendarPlus,
  PlayCircle,
  Users,
  Compass,
  ArrowRight,
} from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { PaceClock } from "@/src/components/lanes";
import { WalkthroughModal } from "./walkthrough-modal";
import styles from "./first-run.module.css";

export interface FirstRunGuideProps {
  hasUpcoming: boolean;
  firstBooking?: {
    id: string;
    startAt: string;
    durationMin: number;
    sessionId: string | null;
    status: string;
  } | null;
  formattedTime?: string;
  suggestions: Array<{
    startAt: string;
    waiting: number;
    popular: boolean;
  }>;
  tz: string;
}

export function FirstRunGuide({
  hasUpcoming,
  firstBooking,
  formattedTime,
  suggestions,
  tz,
}: FirstRunGuideProps) {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const format = useFormatter();
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);

  return (
    <section className={styles.panel} data-tour="first-run">
      <header className={styles.panelHeader}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h2>
            {hasUpcoming
              ? t("firstRunBookedTitle")
              : t("firstRunTitle")}
          </h2>
          <button
            type="button"
            className={styles.secondaryCta}
            onClick={() => window.dispatchEvent(new CustomEvent("focuskept:start-tour"))}
            style={{ minHeight: 38, padding: "6px 14px", fontSize: 13 }}
          >
            <Compass size={15} /> {t("tourBadge")}
          </button>
        </div>
        <p className={styles.lead}>
          {hasUpcoming
            ? t("firstRunBookedLead")
            : t("firstRunLead")}
        </p>
      </header>

      {hasUpcoming ? (
        /* Timeline view when a session is already booked */
        <div className={styles.timeline}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
            <PaceClock
              phase="waiting"
              progress={0}
              focusFrom={0.06}
              wrapFrom={0.94}
              size={64}
            />
            <div>
              <strong style={{ fontSize: 18, color: "var(--text)" }}>
                {formattedTime}
              </strong>
              <p style={{ fontSize: 14, color: "var(--text-2)", margin: 0 }}>
                {c("minutes", { count: firstBooking?.durationMin ?? 50 })} focus session
              </p>
            </div>
          </div>

          <div className={styles.timelineGrid}>
            <div className={styles.timelineItem}>
              <span className={styles.timelineTime}>{t("firstRunTimeline1Time")}</span>
              <strong className={styles.timelineTitle}>{t("firstRunTimeline1Title")}</strong>
              <p className={styles.timelineDesc}>{t("firstRunTimeline1Desc")}</p>
            </div>
            <div className={styles.timelineItem}>
              <span className={styles.timelineTime}>{t("firstRunTimeline2Time")}</span>
              <strong className={styles.timelineTitle}>{t("firstRunTimeline2Title")}</strong>
              <p className={styles.timelineDesc}>{t("firstRunTimeline2Desc")}</p>
            </div>
            <div className={styles.timelineItem}>
              <span className={styles.timelineTime}>{t("firstRunTimeline3Time")}</span>
              <strong className={styles.timelineTitle}>{t("firstRunTimeline3Title")}</strong>
              <p className={styles.timelineDesc}>{t("firstRunTimeline3Desc")}</p>
            </div>
            <div className={styles.timelineItem}>
              <span className={styles.timelineTime}>{t("firstRunTimeline4Time")}</span>
              <strong className={styles.timelineTitle}>{t("firstRunTimeline4Title")}</strong>
              <p className={styles.timelineDesc}>{t("firstRunTimeline4Desc")}</p>
            </div>
          </div>
        </div>
      ) : (
        /* 3-Step Guide when nothing is booked yet */
        <div className={styles.stepsGrid}>
          <article className={styles.stepCard}>
            <div className={styles.stepVisual}>
              <span className={styles.stepBadge}>25 · 50 · 75 min</span>
            </div>
            <h3 className={styles.stepTitle}>{t("firstRunStep1Title")}</h3>
            <p className={styles.stepDesc}>{t("firstRunStep1Desc")}</p>
          </article>

          <article className={styles.stepCard}>
            <div className={styles.stepVisual}>
              <span className={styles.stepBadge} style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                Cameras on · 2 min
              </span>
            </div>
            <h3 className={styles.stepTitle}>{t("firstRunStep2Title")}</h3>
            <p className={styles.stepDesc}>{t("firstRunStep2Desc")}</p>
          </article>

          <article className={styles.stepCard}>
            <div className={styles.stepVisual}>
              <PaceClock
                phase="focus"
                progress={0.4}
                focusFrom={0.06}
                wrapFrom={0.94}
                size={54}
              />
            </div>
            <h3 className={styles.stepTitle}>{t("firstRunStep3Title")}</h3>
            <p className={styles.stepDesc}>{t("firstRunStep3Desc")}</p>
          </article>
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.panelActions}>
        {hasUpcoming ? (
          <>
            {firstBooking?.sessionId && (
              <Link
                href={`/session/${firstBooking.sessionId}`}
                className={styles.primaryCta}
              >
                {t("open")} <ArrowRight size={16} />
              </Link>
            )}
            <Link
              href={`/book?start=${encodeURIComponent(firstBooking?.startAt ?? "")}`}
              className={styles.secondaryCta}
            >
              {t("manage")}
            </Link>
          </>
        ) : (
          <Link href="/book" className={styles.primaryCta}>
            <CalendarPlus size={18} /> {t("firstRunBookCta")}
          </Link>
        )}
        <button
          type="button"
          className={styles.secondaryCta}
          onClick={() => setWalkthroughOpen(true)}
        >
          <PlayCircle size={18} style={{ color: "var(--accent)" }} />
          {t("firstRunWatchWalkthrough")}
        </button>
      </div>

      {/* Suggested Slots if no upcoming session */}
      {!hasUpcoming && suggestions.length > 0 && (
        <div className={styles.quickSuggestions} data-tour="suggestions">
          <span className={styles.quickLabel}>{t("firstRunBookLead")}</span>
          <div className={styles.slotsRow}>
            {suggestions.map((s) => (
              <Link
                key={s.startAt}
                href={`/book?start=${encodeURIComponent(s.startAt)}`}
                className={styles.slotChip}
              >
                <span>
                  {format.dateTime(new Date(s.startAt), {
                    timeZone: tz,
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                {s.waiting > 0 && (
                  <span className={styles.waitingBadge}>
                    <Users size={11} /> {s.waiting}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <WalkthroughModal
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
      />
    </section>
  );
}
