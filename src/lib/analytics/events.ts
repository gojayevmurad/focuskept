export type AnalyticsEvent =
  | "user_signed_up"
  | "user_logged_in"
  | "onboarding_completed"
  | "checkout_started"
  | "payment_completed"
  | "subscription_started"
  | "subscription_canceled"
  | "core_action_completed"
  | "ai_limit_reached"
  | "upgrade_viewed"
  | "locale_switched";
export type CoreFeature =
  "focus_session" | "card_created" | "review_completed" | "task_completed";
// Allowlisted properties only: never user text, ids of content, or emails.
export type EventProperties = {
  plan?: "monthly" | "yearly" | "lifetime";
  feature?: CoreFeature | "ai_analysis" | "card_limit";
  source?:
    | "card_limit"
    | "ai_limit"
    | "lab"
    | "weekly_report"
    | "pricing"
    | "settings";
  locale?: string;
};
