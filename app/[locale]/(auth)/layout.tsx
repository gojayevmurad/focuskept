// SPDX-License-Identifier: AGPL-3.0-only
import { SiteHeader } from "@/src/components/site-header";
import { LaneRope } from "@/src/components/lanes";
import styles from "./auth.module.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className={`auth-page ${styles.authPage}`}>
        <div className={`auth-card card ${styles.authCard}`}>
          <LaneRope className={styles.rope} />
          {children}
        </div>
      </main>
    </>
  );
}
