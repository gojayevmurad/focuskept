// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useState } from "react";
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
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className={`avatar ${size === "md" ? "" : size}`} aria-hidden="true">
      {src && src !== failedUrl ? (
        // Avatars come from OAuth providers or user uploads on other hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(src)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
