// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { X, ChevronRight, ChevronLeft, Check, Compass } from "lucide-react";
import type { AnalyticsEvent } from "@/src/lib/analytics/events";
import styles from "./tour.module.css";

const STORAGE_KEY = "focuskept:tour_seen:v1";

type TourTitleKey =
  | "stepBookTitle"
  | "stepUpcomingTitle"
  | "stepSuggestionsTitle"
  | "stepPeopleTitle"
  | "stepProgressTitle";

type TourDescKey =
  | "stepBookDesc"
  | "stepUpcomingDesc"
  | "stepSuggestionsDesc"
  | "stepPeopleDesc"
  | "stepProgressDesc";

interface TourStep {
  id: string;
  target: string;
  titleKey: TourTitleKey;
  descKey: TourDescKey;
}

const STEPS: TourStep[] = [
  {
    id: "book",
    target: 'a[href="/book"], a[href$="/book"]',
    titleKey: "stepBookTitle",
    descKey: "stepBookDesc",
  },
  {
    id: "upcoming",
    target:
      '[data-tour="upcoming"], [data-tour="first-run"], section[class*="upcoming"]',
    titleKey: "stepUpcomingTitle",
    descKey: "stepUpcomingDesc",
  },
  {
    id: "suggestions",
    target: '[data-tour="suggestions"], [class*="suggestions"]',
    titleKey: "stepSuggestionsTitle",
    descKey: "stepSuggestionsDesc",
  },
  {
    id: "people",
    target: 'a[href="/people"], a[href$="/people"]',
    titleKey: "stepPeopleTitle",
    descKey: "stepPeopleDesc",
  },
  {
    id: "progress",
    target:
      'a[href="/progress"], a[href$="/progress"], [data-tour="stats"], dl[class*="stats"]',
    titleKey: "stepProgressTitle",
    descKey: "stepProgressDesc",
  },
];

async function trackTourEvent(name: "tour_started" | "tour_completed") {
  try {
    const { track } = await import("@/src/lib/analytics/client");
    track(name as unknown as AnalyticsEvent);
  } catch {
    // Optional analytics guard
  }
}

export function Tour({
  autoStart = false,
  isFirstRun = false,
}: {
  autoStart?: boolean;
  isFirstRun?: boolean;
}) {
  const t = useTranslations("tour");
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setActive(true);
    void trackTourEvent("tour_started");
  }, []);

  const completeTour = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    void trackTourEvent("tour_completed");
  }, []);

  const skipTour = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }, []);

  // Listen for manual trigger from help menu / topbar
  useEffect(() => {
    const handleTrigger = () => startTour();
    window.addEventListener("focuskept:start-tour", handleTrigger);
    return () =>
      window.removeEventListener("focuskept:start-tour", handleTrigger);
  }, [startTour]);

  // Automatic trigger on first-run if not yet seen
  useEffect(() => {
    if (!autoStart && !isFirstRun) return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const timer = setTimeout(() => {
          startTour();
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [autoStart, isFirstRun, startTour]);

  const updatePosition = useCallback(() => {
    if (!active) return;
    const currentStep = STEPS[stepIndex];
    if (!currentStep) return;

    const el = document.querySelector(currentStep.target);
    if (!el) {
      // If target element is not present on this screen, center spotlight or skip
      setRect(null);
      setPopoverPos(null);
      return;
    }

    const r = el.getBoundingClientRect();
    setRect(r);

    // Scroll into view if needed
    if (r.top < 80 || r.bottom > window.innerHeight - 80) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Compute popover position for desktop
    const popoverWidth = 380;
    const padding = 16;
    let left = r.left + r.width / 2 - popoverWidth / 2;
    left = Math.max(
      padding,
      Math.min(window.innerWidth - popoverWidth - padding, left),
    );

    let top = r.bottom + 12;
    if (top + 240 > window.innerHeight) {
      // Place above target
      top = Math.max(padding, r.top - 240);
    }

    setPopoverPos({ top, left });
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      updatePosition();
    }, 0);

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [active, updatePosition]);

  // Focus trap & keyboard navigation
  useEffect(() => {
    if (!active) return;

    popoverRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (stepIndex < STEPS.length - 1) {
          setStepIndex((i) => i + 1);
        } else {
          completeTour();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (stepIndex > 0) {
          setStepIndex((i) => i - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, stepIndex, skipTour, completeTour]);

  if (!active) return null;

  const currentStep = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <>
      <div className={styles.overlay} onClick={skipTour} aria-hidden="true" />
      {rect && (
        <div
          className={styles.spotlight}
          style={{
            top: `${Math.max(0, rect.top - 6)}px`,
            left: `${Math.max(0, rect.left - 6)}px`,
            width: `${rect.width + 12}px`,
            height: `${rect.height + 12}px`,
          }}
          aria-hidden="true"
        />
      )}
      <section
        ref={popoverRef}
        tabIndex={-1}
        className={styles.popover}
        style={
          popoverPos && window.innerWidth > 760
            ? {
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
              }
            : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-label={t(currentStep.titleKey)}
      >
        <header className={styles.header}>
          <span className={styles.badge}>
            {t("stepCounter", { current: stepIndex + 1, total: STEPS.length })}
          </span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={skipTour}
            aria-label={t("skip")}
          >
            <X size={16} />
          </button>
        </header>

        <div className={styles.content}>
          <h2 className={styles.title}>{t(currentStep.titleKey)}</h2>
          <p className={styles.description}>{t(currentStep.descKey)}</p>
        </div>

        <footer className={styles.footer}>
          <div className={styles.dots} aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i === stepIndex ? styles.dotActive : ""}`}
              />
            ))}
          </div>
          <div className={styles.actions}>
            {stepIndex > 0 && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setStepIndex((i) => i - 1)}
              >
                <ChevronLeft size={14} /> {t("back")}
              </button>
            )}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                if (isLast) completeTour();
                else setStepIndex((i) => i + 1);
              }}
            >
              {isLast ? (
                <>
                  <Check size={14} /> {t("done")}
                </>
              ) : (
                <>
                  {t("next")} <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </footer>
      </section>
    </>
  );
}

/**
 * Trigger button to replay the product tour from the app shell.
 */
export function TourTrigger({ className }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      className={className ?? "button secondary small"}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("focuskept:start-tour"))
      }
      title={t("takeTour")}
    >
      <Compass size={15} />
      <span>{t("takeTour")}</span>
    </button>
  );
}
