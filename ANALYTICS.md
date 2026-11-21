# Analytics

PostHog is disabled without a public key. Set the correct regional public ingestion host. Client initialization waits for explicit consent; autocapture, pageview/pageleave capture and session recording are disabled. Typed helpers accept a small property allowlist and identify users using internal IDs, never email addresses. Logout resets identity. Clearing site storage reopens consent; authenticated users can also change their preferences in Account settings.

## Events

| Event                 | Intended authority                                |
| --------------------- | ------------------------------------------------- |
| user_signed_up        | Successful registration                           |
| user_logged_in        | Successful email login                            |
| onboarding_completed  | Product-defined completed onboarding              |
| checkout_started      | Server created checkout, browser leaves for Polar |
| payment_completed     | Validated provider payment only                   |
| subscription_started  | Validated provider transition only                |
| subscription_canceled | Validated provider transition only                |
| core_action_completed | Product-defined successful action                 |

The starter emits successful signup, login and checkout events. Product-defined onboarding/core actions have no business behavior until you add a product. Billing hooks emit `payment_completed`, `subscription_started` and `subscription_canceled` from validated notifications after authoritative provider checks. They are never emitted on checkout return.

Authenticated consent is persisted in PostgreSQL through a session- and origin-protected endpoint. Settings includes a permanent preference control. Billing writes pending analytics records in the same transaction as the completed provider event. Delivery happens after commit, with a deterministic UUID for PostHog deduplication. A delivery failure returns 503; provider retry deduplicates the payment mutation and retries pending analytics. Consent withdrawal deletes pending records. No consent or no key means no server capture. Webhook retry exhaustion requires operator redelivery; this small starter intentionally has no background queue.

Enable `customer.state_changed`, `order.paid`, `subscription.active`, and `subscription.canceled` on the Polar webhook endpoint. Revenue and subscription reporting belongs in Polar. A delayed already-refunded order is not reported as a new successful payment.

## Dashboards

- Registrations: unique users with `user_signed_up`, all time and daily trend.
- DAU/WAU/MAU: unique identified users with a meaningful product activity event over 1/7/30 days. Login alone is not a good activity definition.
- Activation: signup → `onboarding_completed` funnel with a defined time window.
- Signup-to-paid: signup → authoritative `payment_completed` funnel with consent/deduplication.
- Retention: cohort returning to `core_action_completed` weekly.
- Feature usage: counts and unique users by allowlisted `feature` property.

Consented cohorts are incomplete by design. Do not present PostHog revenue estimates as accounting records. Use Polar for financial truth. Avoid duplicate captures across both server and client for a single event.
