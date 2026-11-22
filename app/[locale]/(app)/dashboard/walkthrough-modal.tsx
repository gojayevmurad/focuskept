// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Camera,
  MicOff,
  CheckCircle2,
  CalendarPlus,
  Users,
} from "lucide-react";
import { PaceClock, LaneRope } from "@/src/components/lanes";
import styles from "./first-run.module.css";

const TOTAL_STEPS = 5;
const STEP_DURATION_MS = 4500;

const STEP_TITLES = [
  "step1Title",
  "step2Title",
  "step3Title",
  "step4Title",
  "step5Title",
] as const;

const STEP_DESCS = [
  "step1Desc",
  "step2Desc",
  "step3Desc",
  "step4Desc",
  "step5Desc",
] as const;

export function WalkthroughModal({
  open,
  onClose,
  src,
}: {
  open: boolean;
  onClose: () => void;
  src?: string;
}) {
  const t = useTranslations("walkthrough");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  // Sync open state with native dialog.showModal()
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  // Handle prefers-reduced-motion
  useEffect(() => {
    try {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (media.matches) {
        const timer = setTimeout(() => {
          setPlaying(false);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  // Autoplay progression timer
  useEffect(() => {
    if (!open || !playing || src) return;

    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % TOTAL_STEPS);
    }, STEP_DURATION_MS);

    return () => clearInterval(timer);
  }, [open, playing, src]);

  const handlePrev = useCallback(() => {
    setPlaying(false);
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : TOTAL_STEPS - 1));
  }, []);

  const handleNext = useCallback(() => {
    setPlaying(false);
    setCurrentStep((prev) => (prev + 1) % TOTAL_STEPS);
  }, []);

  const handleSelectStep = useCallback((index: number) => {
    setPlaying(false);
    setCurrentStep(index);
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentStep(0);
    setPlaying(true);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`dialog ${styles.walkthroughDialog}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-labelledby="walkthrough-heading"
    >
      <div className={styles.walkthroughBody}>
        <header className={styles.walkthroughHeader}>
          <div>
            <h2 id="walkthrough-heading" className={styles.walkthroughTitle}>
              {t("title")}
            </h2>
            <p className={styles.walkthroughSub}>{t("subtitle")}</p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t("close")}
          >
            <X size={18} />
          </button>
        </header>

        {/* Video or Code-Drawn Interactive Animation Stage */}
        <div className={styles.stage}>
          {src ? (
            <video
              src={src}
              className={styles.stageVideo}
              controls
              autoPlay
              muted
              playsInline
            />
          ) : (
            <div className={styles.sceneGraphic}>
              {currentStep === 0 && <SceneBooking />}
              {currentStep === 1 && <SceneMatching />}
              {currentStep === 2 && <SceneIntro />}
              {currentStep === 3 && <SceneFocus />}
              {currentStep === 4 && <SceneWrapUp />}
            </div>
          )}
        </div>

        {/* Captions area */}
        <div className={styles.captionArea} aria-live="polite">
          <h3 className={styles.captionTitle}>
            {t(STEP_TITLES[currentStep] ?? "step1Title")}
          </h3>
          <p className={styles.captionText}>
            {t(STEP_DESCS[currentStep] ?? "step1Desc")}
          </p>
        </div>

        {/* Scrubber Controls */}
        <div className={styles.controlsBar}>
          <div className={styles.playPauseRow}>
            {!src && (
              <>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? t("pause") : t("play")}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={handleRestart}
                  aria-label={t("replay")}
                >
                  <RotateCcw size={15} />
                </button>
              </>
            )}
            <div className={styles.scrubberDots} role="tablist">
              {[0, 1, 2, 3, 4].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={currentStep === idx}
                  className={`${styles.scrubberDot} ${currentStep === idx ? styles.scrubberDotActive : ""}`}
                  onClick={() => handleSelectStep(idx)}
                >
                  <span>{idx + 1}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.navArrows}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={handlePrev}
              aria-label={t("prev")}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={handleNext}
              aria-label={t("next")}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/** Scene 1: Booking a lane */
function SceneBooking() {
  return (
    <div
      style={{ display: "grid", gap: 12, placeItems: "center", width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "8px 16px",
          borderRadius: 999,
          background: "var(--surface)",
          border: "1px solid var(--accent)",
          boxShadow: "0 2px 8px rgba(8, 100, 107, 0.15)",
        }}
      >
        <CalendarPlus size={18} style={{ color: "var(--accent)" }} />
        <strong style={{ fontSize: 14 }}>50 min focus lane · 2:00 PM</strong>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {["25 min", "50 min", "75 min"].map((d, i) => (
          <span
            key={d}
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: i === 1 ? "var(--accent)" : "var(--surface)",
              color: i === 1 ? "var(--accent-ink)" : "var(--text-2)",
              border: "1px solid var(--line-strong)",
            }}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Scene 2: Matching at T-5 */
function SceneMatching() {
  return (
    <div className={styles.lanesVisual}>
      <div className={`${styles.laneBox} ${styles.laneBoxActive}`}>
        <span className={styles.laneLabel}>Lane 1</span>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
          }}
        >
          You
        </div>
        <span style={{ fontSize: 12, color: "var(--ok)", fontWeight: 600 }}>
          Assigned
        </span>
      </div>
      <LaneRope vertical />
      <div className={`${styles.laneBox} ${styles.laneBoxActive}`}>
        <span className={styles.laneLabel}>Lane 2</span>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
          }}
        >
          <Users size={18} />
        </div>
        <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
          Partner matched
        </span>
      </div>
    </div>
  );
}

/** Scene 3: Intro (2 minutes) */
function SceneIntro() {
  return (
    <div
      style={{ display: "grid", placeItems: "center", gap: 12, width: "100%" }}
    >
      <PaceClock
        phase="intro"
        progress={0.03}
        focusFrom={0.06}
        wrapFrom={0.94}
        size={68}
      />
      <div className={styles.lanesVisual}>
        <div className={styles.laneBox}>
          <div className={styles.cameraIndicator}>
            <Camera size={12} /> Camera on
          </div>
          <span className={styles.laneGoal}>&ldquo;Draft section 1&rdquo;</span>
        </div>
        <LaneRope vertical />
        <div className={styles.laneBox}>
          <div className={styles.cameraIndicator}>
            <Camera size={12} /> Camera on
          </div>
          <span className={styles.laneGoal}>&ldquo;Review 3 PRs&rdquo;</span>
        </div>
      </div>
    </div>
  );
}

/** Scene 4: Quiet Focus */
function SceneFocus() {
  return (
    <div
      style={{ display: "grid", placeItems: "center", gap: 12, width: "100%" }}
    >
      <PaceClock
        phase="focus"
        progress={0.5}
        focusFrom={0.06}
        wrapFrom={0.94}
        size={76}
      />
      <div className={styles.lanesVisual}>
        <div className={styles.laneBox}>
          <div className={styles.micOffIndicator}>
            <MicOff size={12} /> Muted
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Deep work</span>
        </div>
        <LaneRope vertical />
        <div className={styles.laneBox}>
          <div className={styles.micOffIndicator}>
            <MicOff size={12} /> Muted
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Deep work</span>
        </div>
      </div>
    </div>
  );
}

/** Scene 5: Wrap-up & celebration */
function SceneWrapUp() {
  return (
    <div
      style={{ display: "grid", placeItems: "center", gap: 12, width: "100%" }}
    >
      <PaceClock
        phase="wrap"
        progress={0.98}
        focusFrom={0.06}
        wrapFrom={0.94}
        size={68}
      />
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 16px",
          borderRadius: 999,
          background: "var(--ok-soft)",
          color: "var(--ok)",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        <CheckCircle2 size={18} />
        Session complete · Marked Done
      </div>
    </div>
  );
}
