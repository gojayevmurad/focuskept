// SPDX-License-Identifier: AGPL-3.0-only
import Link from "next/link";
import "./globals.css";

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <main className="empty-state">
          <h1>Page not found</h1>
          <Link className="button" href="/">
            Go home
          </Link>
        </main>
      </body>
    </html>
  );
}
