// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { testAlertEmail } from "./actions";
export function TestButton() {
  const t = useTranslations("admin.notifications");
  const [pending, start] = useTransition();
  const [sent, setSent] = useState<boolean | null>(null);
  return <div><button className="button secondary" disabled={pending} onClick={() => start(async () => {
    try { setSent((await testAlertEmail()).sent); } catch { setSent(false); }
  })}>{t(pending ? "sending" : "test")}</button>
    {sent !== null && <p className="small muted" role="status">{t(sent ? "testSent" : "testFailed")}</p>}
  </div>;
}
