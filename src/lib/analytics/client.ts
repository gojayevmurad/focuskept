// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import posthog from "posthog-js";
import type { AnalyticsEvent, EventProperties } from "./events";
import { getAttributionFromDocument, channelFor } from "@/src/lib/attribution";

export type AnalyticsConfig = {
  enabled: boolean;
  key?: string;
  host?: string;
  assetsHost?: string;
  apiHost?: string;
  uiHost?: string;
};

let initialized = false;
let ctaListenerAttached = false;
let activeConfig: AnalyticsConfig | null = null;

export function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("analytics-consent") === "yes";
}

export function isAnalyticsInitialized(): boolean {
  return initialized;
}

export function initAnalytics(config?: AnalyticsConfig) {
  if (config) activeConfig = config;
  const cfg = activeConfig;
  if (!cfg?.enabled || !cfg.key) return;

  if (!initialized) {
    posthog.init(cfg.key, {
      api_host: cfg.apiHost || "/ingest",
      ui_host: cfg.uiHost || "https://us.i.posthog.com",
      asset_host: cfg.assetsHost || "https://us-assets.i.posthog.com",
      autocapture: false,
      capture_pageview: "history_change",
      capture_pageleave: true,
      disable_session_recording: true,
      person_profiles: "identified_only",
      cookieless_mode: "on_reject",
      opt_out_capturing_by_default: true,
      capture_performance: false,
      capture_exceptions: false,
      save_referrer: true,
      save_campaign_params: true,
    });
    initialized = true;

    // Attach data-cta delegated click listener
    if (!ctaListenerAttached && typeof document !== "undefined") {
      document.addEventListener(
        "click",
        (event) => {
          const target = (event.target as Element)?.closest?.("[data-cta]");
          if (!target) return;
          const label =
            target.getAttribute("data-cta") || target.textContent?.trim() || "";
          const location =
            target.getAttribute("data-cta-location") || window.location.pathname;
          track("cta_clicked", { location, label });
        },
        { capture: true },
      );
      ctaListenerAttached = true;
    }
  }

  // If consent was previously granted, activate opt-in and capture features
  if (hasConsent()) {
    posthog.opt_in_capturing();
    posthog.set_config({
      capture_exceptions: true,
      capture_performance: { web_vitals: true },
    });
  } else {
    // Keep in cookieless opt-out mode
    posthog.opt_out_capturing();
    posthog.set_config({
      capture_exceptions: false,
      capture_performance: false,
    });
  }
}

export function enableAnalytics() {
  if (!initialized && activeConfig) {
    initAnalytics(activeConfig);
  }
  if (initialized) {
    posthog.opt_in_capturing();
    posthog.set_config({
      capture_exceptions: true,
      capture_performance: { web_vitals: true },
    });
  }
}

export function disableAnalytics() {
  resetAnalytics();
  if (initialized) {
    posthog.opt_out_capturing();
    posthog.set_config({
      capture_exceptions: false,
      capture_performance: false,
    });
  }
}

export function track(event: AnalyticsEvent, properties: EventProperties = {}) {
  if (!initialized && activeConfig) {
    initAnalytics(activeConfig);
  }
  if (!initialized) return;

  const props: EventProperties = { ...properties };

  // For signup events, ensure channel is populated from attribution cookie if not set
  if (event === "signup" && !props.channel) {
    const attr = getAttributionFromDocument();
    props.channel = channelFor(attr);
  }

  posthog.capture(event, props);
}

export function identify(id: string) {
  if (!initialized && activeConfig) {
    initAnalytics(activeConfig);
  }
  // Only identify when explicit consent has been given (no person profiles for anonymous visitors)
  if (initialized && hasConsent()) {
    posthog.identify(id);
  }
}

export function resetAnalytics() {
  if (initialized) posthog.reset();
}

// Typed funnel event helpers
export function trackCta(location: string, label: string) {
  track("cta_clicked", { location, label });
}

export function trackSignupStarted(properties: EventProperties = {}) {
  track("signup_started", properties);
}

export function trackBookingViewed(properties: EventProperties = {}) {
  track("booking_viewed", properties);
}

export function trackSessionJoined(properties: EventProperties = {}) {
  track("session_joined", properties);
}

export function trackVideoFailed(
  reason: string,
  properties: EventProperties = {},
) {
  track("video_failed", { reason, ...properties });
}

export function trackTourStarted(
  tourName?: string,
  properties: EventProperties = {},
) {
  track("tour_started", { tourName, ...properties });
}

export function trackTourCompleted(
  tourName?: string,
  properties: EventProperties = {},
) {
  track("tour_completed", { tourName, ...properties });
}

export function trackHelpViewed(
  topic?: string,
  properties: EventProperties = {},
) {
  track("help_viewed", { topic, ...properties });
}

export function trackSupportTicketCreated(
  category?: string,
  properties: EventProperties = {},
) {
  track("support_ticket_created", { category, ...properties });
}

export function trackEmailTipsUnsubscribed(properties: EventProperties = {}) {
  track("email_tips_unsubscribed", properties);
}
