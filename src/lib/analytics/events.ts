// SPDX-License-Identifier: AGPL-3.0-only
import type { HeardFrom } from "@/src/lib/attribution/types";

export type AnalyticsEvent =
  | "user_signed_up"
  | "user_logged_in"
  | "onboarding_completed"
  | "checkout_started"
  | "payment_completed"
  | "subscription_started"
  | "subscription_canceled"
  | "core_action_completed"
  // Product metrics
  | "signup"
  | "booking_created"
  | "session_matched"
  | "session_completed"
  | "session_quality"
  | "upgrade_started"
  | "upgrade_completed"
  | "referral_sent"
  | "referral_converted"
  | "share_card_created"
  // Funnel events
  | "cta_clicked"
  | "signup_started"
  | "booking_viewed"
  | "session_joined"
  | "video_failed"
  | "tour_started"
  | "tour_completed"
  | "help_viewed"
  | "support_ticket_created"
  | "email_tips_unsubscribed";

export type EventProperties = {
  plan?: "monthly" | "yearly" | "lifetime";
  feature?: string;
  location?: string;
  label?: string;
  reason?: string;
  tourName?: string;
  topic?: string;
  category?: string;
  channel?: string;
  segments?: number;
  heard_from?: HeardFrom;
  $set_once?: Record<string, string | number | boolean | undefined>;
  [key: string]:
    | string
    | number
    | boolean
    | undefined
    | Record<string, string | number | boolean | undefined>;
};
