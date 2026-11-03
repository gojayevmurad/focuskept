import { brand } from "@/src/config/brand";

/** "Captured moment": an open timer ring with the kept moment in amber. */
export const MARK_RING = "M39 24 A15 15 0 1 1 31.5 11.01";
export const MARK_DOT = { cx: 37, cy: 16.5, r: 4.5 };
export const AMBER = "#F2B33D";

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <path
          d={MARK_RING}
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle {...MARK_DOT} fill={AMBER} />
      </svg>
    </span>
  );
}

export function Logo() {
  return (
    <>
      <LogoMark />
      <span>{brand.name}</span>
    </>
  );
}
