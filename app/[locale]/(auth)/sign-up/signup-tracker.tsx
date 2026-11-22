// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect } from "react";
import { trackSignupStarted } from "@/src/lib/analytics/client";

export function SignupTracker() {
  useEffect(() => {
    trackSignupStarted();
  }, []);

  return null;
}
