# Billing

Billing is optional. During early access, keep `BILLING_ENABLED=false`: everyone gets Plus and no payment UI is shown. The public landing page and FAQ explain the later free limit and the three free months of Plus for early members.

## Ending early access

When billing starts, set `BILLING_ENABLED=true` and keep `FREE_WEEKLY_SESSIONS=3`. Set both optional founding-member dates:

- `FOUNDING_SIGNUP_BEFORE`: the end of early access; only accounts whose `user.createdAt` is strictly before this cutoff qualify.
- `FOUNDING_PLUS_UNTIL`: the end of their three free months of Plus, three calendar months after billing starts. Access ends at this instant.

Both accept ISO dates (`YYYY-MM-DD`, interpreted as midnight UTC) or ISO timestamps with `Z` or an explicit offset. For example, if billing starts on `2027-02-01T00:00:00Z`, use that as `FOUNDING_SIGNUP_BEFORE` and `2027-05-01T00:00:00Z` as `FOUNDING_PLUS_UNTIL`. These are shared operator-configured dates, not a rolling trial per user. Leaving either unset disables the founding perk. After expiry, the usual subscription, house, host and community access rules apply; otherwise the user gets Free.

## Plans

- **Free**: 3 sessions per local week (`FREE_WEEKLY_SESSIONS`), matching, streaks.
- **Plus**: unlimited sessions, favorite partners, advanced matching filters. Monthly and yearly products in Polar, both with a 7 day trial.

Prices live only in Polar; the pricing page reads them at runtime. People can also get Plus without paying: house accounts, the monthly host perk and group licences (see `src/lib/billing/plan.ts`).

## Polar setup

Create the Plus monthly and yearly products with a 7 day trial and attach one custom benefit ("Plus") to both. Set `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_MONTHLY_PRODUCT_ID`, `POLAR_YEARLY_PRODUCT_ID` and `POLAR_PRO_BENEFIT_ID` (the Plus benefit id), then `BILLING_ENABLED=true`. Use a sandbox organization and `POLAR_ENVIRONMENT=sandbox` until you are ready to take payments.

Add a webhook (API version 2026-10) to `/api/webhooks/polar` with `customer.state_changed`, `order.paid`, `subscription.active`, `subscription.updated`, `subscription.canceled` and `subscription.revoked`.

## How access is decided

1. Checkout is created on the server for a known plan key; the browser never sends prices or user ids. Customers can enter discount codes, and a pending referral reward is attached automatically as a discount.
2. Returning from checkout grants nothing. A signed webhook takes a per-user advisory lock, fetches the customer's current state from Polar and stores the subscription snapshot and a 15 minute entitlement lease in one transaction.
3. Duplicate and out-of-order deliveries are harmless: each one reloads the current state. Failures roll back and return 503 so Polar retries.
4. An expired lease is refreshed from Polar on the next check; if Polar is unreachable, access falls back to Free.

Cancellation, invoices and payment methods are handled in the Polar customer portal (Plan page). A person with a running subscription has to cancel before deleting their account.

## Referral rewards

When an invited person finishes their first session, both get a single-use 100% discount for one month. It is applied to a running subscription or attached to the next checkout. Failed rewards are retried daily by the worker.

## Before taking money

Test in the sandbox: monthly and yearly checkout with the trial, renewal, failed payment, cancellation at period end, refund and benefit revocation, webhook retries and duplicate delivery.
