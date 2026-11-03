// Pro is sold monthly ($5) and yearly ($40). The lifetime plan is disabled:
// hidden in the UI and rejected by checkout validation.
export const LIFETIME_ENABLED = false;
export const CHECKOUT_PLANS = ["monthly", "yearly"] as const;
export type CheckoutPlan = (typeof CHECKOUT_PLANS)[number];
export const PRICES_USD = { monthly: 5, yearly: 40 } as const;
