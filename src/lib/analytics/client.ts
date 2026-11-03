"use client";
import posthog from "posthog-js";
import type { AnalyticsEvent, EventProperties } from "./events";
let initialized = false;
export function enableAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  if (!initialized) {
    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
    });
    initialized = true;
  }
  posthog.opt_in_capturing();
}
export function track(event: AnalyticsEvent, properties: EventProperties = {}) {
  if (initialized && localStorage.getItem("analytics-consent") === "yes")
    posthog.capture(event, properties);
}
export function identify(id: string) {
  if (initialized && localStorage.getItem("analytics-consent") === "yes")
    posthog.identify(id);
}
export function resetAnalytics() {
  if (initialized) posthog.reset();
}
export function disableAnalytics() {
  resetAnalytics();
  if (initialized) posthog.opt_out_capturing();
}
