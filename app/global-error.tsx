// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
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
              Something went wrong.
            </h1>
            <p style={{ color: "var(--text-2)", margin: 0 }}>
              Please try again in a moment.
            </p>
            <button className="button" onClick={reset}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
