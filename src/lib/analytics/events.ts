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
  | "share_card_created";
export type EventProperties = {
  plan?: "monthly" | "yearly" | "lifetime";
  feature?: string;
  [key: string]: string | number | boolean | undefined;
};
