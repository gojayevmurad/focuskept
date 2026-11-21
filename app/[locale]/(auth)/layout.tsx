// SPDX-License-Identifier: AGPL-3.0-only
import { SiteHeader } from "@/src/components/site-header";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="auth-page">
        <div className="auth-card card">{children}</div>
      </main>
    </>
  );
}
