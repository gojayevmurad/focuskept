// SPDX-License-Identifier: AGPL-3.0-only
import { Link } from "@/src/i18n/navigation";
import { brandGeometry, fullSymbolMinPx } from "@/src/config/brand-assets";

/**
 * The Side by Side symbol, drawn from the kit geometry. Decorative: whatever
 * sits next to it carries the accessible name. Colors come from brand.css so
 * the mark follows the theme; the micro cut is used below 32px as the kit says.
 */
export function LogoMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const d =
    size < fullSymbolMinPx ? brandGeometry.microLeft : brandGeometry.left;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={brandGeometry.viewBox}
      aria-hidden="true"
      focusable="false"
    >
      <g transform={brandGeometry.offset}>
        <path d={d} fill="var(--logo-mark)" />
        <path
          d={d}
          transform={brandGeometry.rightTransform}
          fill="var(--logo-mark-companion)"
        />
      </g>
    </svg>
  );
}

/**
 * Deployment logo: LOGO_URL replaces the built-in symbol; the name is always
 * live text so custom deployments never show the FocusKept wordmark.
 */
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
