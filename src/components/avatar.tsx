// SPDX-License-Identifier: AGPL-3.0-only
import { initials } from "@/src/lib/profiles/rules";

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const style =
    size === "sm" ? { width: 30, height: 30, fontSize: 12 } : undefined;
  return (
    <span
      className={`avatar ${size === "lg" ? "lg" : ""}`}
      style={style}
      aria-hidden="true"
    >
      {src ? (
        // Avatars come from OAuth providers or user uploads on other hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
