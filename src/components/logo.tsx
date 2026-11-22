// SPDX-License-Identifier: AGPL-3.0-only
import { Link } from "@/src/i18n/navigation";

/** Two pool lanes sharing a float rope and a pace-clock marker. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M4 8a3 3 0 0 1 3-3h5v22H7a3 3 0 0 1-3-3V8Zm16-3h5a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3h-5V5Z"
        fill="var(--accent)"
      />
      <path
        d="M16 7v18"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 11v3m0 8v3"
        stroke="var(--rope-red)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M16 17v2"
        stroke="var(--rope-yellow)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="26" cy="5" r="3" fill="var(--rope-red)" />
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
