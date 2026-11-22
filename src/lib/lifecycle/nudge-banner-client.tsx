// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import styles from "./nudge.module.css";

type Props = {
  slotIso: string;
  formattedTime: string;
  waitingCount: number;
  bookUrl: string;
  promptLabel: string;
  waitingLabel: string;
  bookLabel: string;
  dismissLabel: string;
};

export function NudgeBannerClient({
  slotIso,
  formattedTime,
  waitingCount,
  bookUrl,
  promptLabel,
  waitingLabel,
  bookLabel,
  dismissLabel,
}: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`focuskept:nudge_dismissed:${slotIso}`);
      if (!stored) {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, [slotIso]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`focuskept:nudge_dismissed:${slotIso}`, "true");
    } catch {}
  };

  if (dismissed) return null;

  return (
    <div className={styles.nudgeBanner} role="complementary">
      <div className={styles.left}>
        <span className={styles.icon}>
          <Sparkles size={16} />
        </span>
        <span className={styles.text}>
          <span className={styles.prompt}>{promptLabel}</span>{" "}
          <strong>{formattedTime}</strong>
          {waitingCount > 0 && (
            <span className={styles.waitingBadge}> · {waitingLabel}</span>
          )}
        </span>
      </div>
      <div className={styles.actions}>
        <Link href={bookUrl} className="button small">
          {bookLabel}
        </Link>
        <button
          className={styles.dismissButton}
          onClick={handleDismiss}
          type="button"
          aria-label={dismissLabel}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
