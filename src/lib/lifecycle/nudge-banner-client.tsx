// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useState, useSyncExternalStore } from "react";
import { Sparkles, X } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { usePathname } from "@/src/i18n/navigation";
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

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

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
  const pathname = usePathname();
  const [manuallyDismissed, setManuallyDismissed] = useState(false);

  const isStoredDismissed = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return !!localStorage.getItem(`focuskept:nudge_dismissed:${slotIso}`);
      } catch {
        return false;
      }
    },
    () => true,
  );

  const dismissed = manuallyDismissed || isStoredDismissed;

  const handleDismiss = () => {
    setManuallyDismissed(true);
    try {
      localStorage.setItem(`focuskept:nudge_dismissed:${slotIso}`, "true");
    } catch {}
  };

  if (dismissed || !["/dashboard", "/book"].includes(pathname)) return null;

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
