# Billing

## Configure the sandbox

Create a separate Polar sandbox organization and organization token. Create fixed-price monthly, yearly and one-time products. Attach the SAME custom Pro benefit to each. Set product IDs, `POLAR_PRO_BENEFIT_ID`, token and webhook signing secret. Keep `POLAR_ENVIRONMENT=sandbox` during development.

Create a **2026-10** webhook endpoint at `/api/webhooks/polar`, with `customer.state_changed`, `order.paid`, `subscription.active` and `subscription.canceled` enabled. The official SDK verifies the raw body, signature and timestamp. Unknown, invalid or unsigned payloads are rejected. Other valid event types are acknowledged and ignored; fresh customer state is the entitlement authority for every handled event. Billing analytics uses a consent-aware transactional outbox.

## Lifecycle

1. An authenticated, verified user selects an allowlisted plan key. The server looks up the product and derives the external customer ID from the session. Client amounts and user IDs are never accepted.
2. Polar hosts checkout. The success URL only displays a return state and never grants access.
3. A signed customer-state notification acquires a PostgreSQL advisory lock for that user. The handler checks event deduplication, fetches fresh authoritative state from Polar, replaces the subscription snapshot, updates the entitlement lease, and records completion in the SAME transaction.
4. A duplicate returns success. Delayed/out-of-order notifications fetch current state rather than applying old payload state. Fetch or database failures roll back everything and return 503 for provider retries. The lock is acquired before fetching, preventing concurrent stale snapshots from overwriting newer ones.
5. Active benefit grants determine Pro access. This handles one-time purchases, refunds, payment failure, revocation and subscription expiration according to Polar's current benefit state. Cancellation at period end can retain access while the benefit remains granted. The customer portal owns cancellation, invoices and payment-method changes.
6. Server entitlement checks accept only a current lease. An expired lease is reconciled; provider failures deny access. No benefit record means Free. Refund revocation may lag by up to 15 minutes without a webhook; select a shorter lease for higher-risk products.

Configure Polar refund and benefit revocation policies deliberately. Verify full and partial refunds, failed renewals and immediate versus period-end cancellation. Never assume a partial refund revokes a benefit unless the provider configuration does so.

`hasActiveSubscription` describes the stored subscription snapshot; authorization uses `hasEntitlement`. Lifetime users can have Pro with no subscription. `getCurrentPlan` reports effective access, not an invoice status. `requireEntitlement` is available for protected server operations.

## Recovery and retention

Redeliver failed customer-state events from Polar. For an emergency reconciliation, call the server `reconcile(userId)` helper from a controlled operator script. Do not expose it publicly. Duplicate-event IDs must be retained at least as long as provider redelivery remains possible. Do not delete them as part of normal user account cleanup. Never log payloads or checkout/portal URLs.

## Required external verification

Sandbox credentials are not included. Before accepting money, test monthly/yearly/one-time checkout, webhook signatures and retries, duplicate delivery, cancellation, refund, failed payment, renewal, and delayed delivery. Verify dashboard access through the real benefit lifecycle. Provider fixtures prove transaction behavior, not the remote provider's configured policies. See VERIFICATION.md for actual local results.
