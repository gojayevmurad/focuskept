// SPDX-License-Identifier: AGPL-3.0-only
import Link from "next/link";
import "./globals.css";

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <main
          className="empty-state"
          style={{
            minHeight: "100svh",
            display: "grid",
            placeItems: "center",
            padding: "32px 16px",
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "var(--lane)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius)",
              padding: "clamp(36px, 6vw, 56px) clamp(20px, 5vw, 40px)",
              textAlign: "center",
              display: "grid",
              gap: "20px",
              justifyItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(72px, 14vw, 112px)",
                fontWeight: 750,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              404
            </div>
            <span
              aria-hidden="true"
              style={{
                display: "block",
                width: "100%",
                maxWidth: "240px",
                height: "8px",
                borderRadius: "999px",
                background:
                  "repeating-linear-gradient(90deg, var(--rope-red) 0 14px, var(--rope-white) 14px 19px, var(--rope-yellow) 19px 33px, var(--rope-white) 33px 38px)",
              }}
            />
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 5vw, 36px)",
                fontWeight: 750,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                margin: 0,
              }}
            >
              Page not found
            </h1>
            <Link className="button" href="/">
              Go home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
