# Billing

Billing is optional. With `BILLING_ENABLED=false` everyone gets every feature and no payment UI is shown.

## Plans

- **Free**: 3 sessions per local week (`FREE_WEEKLY_SESSIONS`), matching, streaks.
- **Plus**: unlimited sessions, favorite partners, advanced matching filters. Monthly and yearly products in Polar, both with a 7 day trial.

Prices live only in Polar; the pricing page reads them at runtime. People can also get Plus without paying: house accounts, the monthly host perk and group licences (see `src/lib/billing/plan.ts`).

## Polar setup

Create the Plus monthly and yearly products with a 7 day trial and attach one custom benefit ("Plus") to both. Set `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_MONTHLY_PRODUCT_ID`, `POLAR_YEARLY_PRODUCT_ID` and `POLAR_PRO_BENEFIT_ID` (the Plus benefit id), then `BILLING_ENABLED=true`. Use a sandbox organization and `POLAR_ENVIRONMENT=sandbox` until you are ready to take payments.

Add a webhook (API version 2026-10) to `/api/webhooks/polar` with `customer.state_changed`, `order.paid`, `subscription.active`, `subscription.updated`, `subscription.canceled` and `subscription.revoked`.

## How access is decided

1. Checkout is created on the server for a known plan key; the browser never sends prices or user ids. A pending referral reward is attached as a discount.
2. Returning from checkout grants nothing. A signed webhook takes a per-user advisory lock, fetches the customer's current state from Polar and stores the subscription snapshot and a 15 minute entitlement lease in one transaction.
3. Duplicate and out-of-order deliveries are harmless: each one reloads the current state. Failures roll back and return 503 so Polar retries.
4. An expired lease is refreshed from Polar on the next check; if Polar is unreachable, access falls back to Free.

Cancellation, invoices and payment methods are handled in the Polar customer portal (Plan page). A person with a running subscription has to cancel before deleting their account.

## Referral rewards

When an invited person finishes their first session, both get a single-use 100% discount for one month. It is applied to a running subscription or attached to the next checkout. Failed rewards are retried daily by the worker.

## Before taking money

Test in the sandbox: monthly and yearly checkout with the trial, renewal, failed payment, cancellation at period end, refund and benefit revocation, webhook retries and duplicate delivery.
