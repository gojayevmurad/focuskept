export type AnalyticsEvent =
  | "user_signed_up"
  | "user_logged_in"
  | "onboarding_completed"
  | "checkout_started"
  | "payment_completed"
  | "subscription_started"
  | "subscription_canceled"
  | "core_action_completed";
export type EventProperties = {
  plan?: "monthly" | "yearly" | "lifetime";
  feature?: string;
};
