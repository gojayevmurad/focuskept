// SPDX-License-Identifier: AGPL-3.0-only
import styles from "./lanes.module.css";

/** The float line between two swimming lanes. Purely decorative. */
export function LaneRope({
  vertical = false,
  className,
}: {
  vertical?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={[styles.rope, vertical && styles.vertical, className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
