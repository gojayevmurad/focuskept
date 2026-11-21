// SPDX-License-Identifier: AGPL-3.0-only
import { Link } from "@/src/i18n/navigation";

/** Two overlapping circles: two people, one session. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="12" cy="16" r="9" fill="var(--accent)" />
      <circle
        cx="20"
        cy="16"
        r="9"
        fill="none"
        stroke="var(--warm)"
        strokeWidth="3"
      />
    </svg>
  );
}

export function Logo({
  name,
  logoUrl,
  href = "/",
}: {
  name: string;
  logoUrl?: string;
  href?: string;
}) {
  return (
    <Link href={href} className="logo" aria-label={name}>
      {logoUrl ? (
        // Self-hosters can point LOGO_URL anywhere, so this stays a plain img.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" />
      ) : (
        <LogoMark />
      )}
      <span>{name}</span>
    </Link>
  );
}
