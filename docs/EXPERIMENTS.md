# Growth Experiments & A/B Testing Guide

This guide explains how to design, execute, and analyze controlled experiments and A/B tests in FocusKept without client-side flicker, using PostHog feature flags and server components.

---

## 1. Core Principles

1. **Hypothesis-Driven**: Every test begins with an explicit causal statement, not just "let's see what happens."
2. **Test One Variable**: Isolate a single variable per experiment so outcomes are unambiguously attributable.
3. **Zero Client Flicker**: Evaluate variants on the server with `getFeatureFlag` before HTML streams to the browser.
4. **Statistical Rigor**: Commit to a pre-calculated sample size, fixed evaluation horizon, and guardrail metrics. Avoid stopping early based on preliminary peeking.
5. **Privacy by Default**: Users are identified solely by internal unique ID, never by email or personal data. If analytics is unconfigured or consent is absent, the system safely falls back to the control experience.

---

## 2. Hypothesis Framework

Before creating any feature flag or coding variants, state the hypothesis in this structure:

```
Because [observation / quantitative data / user feedback],
we believe [specific intervention / change]
will cause [expected outcome / lift]
for [target audience / segment].
We'll know this is true when [primary metric] changes by at least [MDE],
while keeping [guardrail metrics] stable.
```

### Example

- **Observation**: 45% of new signups do not book a session within 24 hours of onboarding.
- **Hypothesis**: Because new users struggle with choice overload when viewing the full calendar, showing a single pre-selected popular slot in the app shell will increase first-booking creation within 24h by 15% for new users, without increasing cancellations.
- **Primary Metric**: `booking_created` rate within 24h of signup.
- **Secondary Metric**: Time-to-first-booking.
- **Guardrail Metric**: `session_cancelled` rate and late-cancellation count.

---

## 3. Creating the Experiment in PostHog

1. In PostHog, navigate to **Experiments** → **New experiment**.
2. **Feature flag key**: Use a descriptive kebab-case identifier (e.g. `exp-activation-nudge-slot` or `exp-invite-reward-copy`).
3. **Variants**:
   - `control` (baseline): 50% rollout.
   - `test` (or specific variant name): 50% rollout.
4. **Targeting**: Filter by identified users (by default, `user.id`).
5. **Primary Goal Metric**: Select the corresponding event (e.g. `booking_created`, `session_completed`, `referral_sent`).
6. **Minimum Detectable Effect (MDE)**: Define target relative lift (e.g. 10% to 20%). PostHog calculates the required sample size and estimated experiment duration.

---

## 4. Server-Side Flag Evaluation (Zero Flicker)

Import the server helper `getFeatureFlag` or `isFeatureEnabled` from `@/src/lib/lifecycle/flags`:

```tsx
import { requireAppUser } from "@/src/lib/app-user";
import { getFeatureFlag } from "@/src/lib/lifecycle/flags";

export default async function FeaturePage() {
  const { user } = await requireAppUser();

  // Evaluates flag server-side; falls back to "control" if analytics is off
  const variant = await getFeatureFlag(
    user.id,
    "exp-invite-reward-copy",
    "control",
  );

  return (
    <div>
      {variant === "variant-a" ? (
        <RewardHeadlineVariantA />
      ) : (
        <RewardHeadlineControl />
      )}
    </div>
  );
}
```

For binary feature switches:

```tsx
import { isFeatureEnabled } from "@/src/lib/lifecycle/flags";

const showNewFeature = await isFeatureEnabled(user.id, "exp-new-nudge", false);
```

### Fallback Guarantee

If `POSTHOG_KEY` is not configured, or if the network request exceeds 1.5s, the helper returns the fallback (`control` or `false`). The user experience is never degraded or delayed.

---

## 5. Tracking Metrics

Track conversion events with the standard server or client analytics helpers:

### Server Events

```ts
import { trackForUser } from "@/src/lib/analytics/product";

await trackForUser(user.id, "booking_created", {
  durationMin: 50,
});
```

### Client Events

```ts
import { track } from "@/src/lib/analytics/client";

track("referral_sent");
```

---

## 6. Statistical Analysis & Decision Rules

| Metric                        | Target / Standard                                                                                 |
| :---------------------------- | :------------------------------------------------------------------------------------------------ |
| **Significance Level (α)**    | 0.05 (95% confidence)                                                                             |
| **Statistical Power (1 - β)** | 0.80 (80% power)                                                                                  |
| **Stopping Rule**             | Pre-determined sample size reached; do not stop early on temporary spikes                         |
| **Decision Threshold**        | Statistically significant lift with confidence interval entirely above zero and intact guardrails |

### Outcome Actions

1. **Clear Winner**: Roll out variant to 100% in PostHog, remove branching code, document winning pattern in the experiment playbook.
2. **Clear Loser**: Deactivate experiment, revert to control, document learnings on user friction or objections.
3. **Inconclusive**: If confidence intervals span zero after reaching target sample size, keep the simpler/cheaper version and archive the test.

---

## 7. Experiment Playbook Template

When concluding a test, record results:

```markdown
### [Experiment Name]

- **Date**: YYYY-MM-DD
- **Flag Key**: `exp-...`
- **Hypothesis**: ...
- **Sample Size**: [N per arm]
- **Results**: Control: [X%], Test: [Y%] (Lift: +Z%, p = [val], 95% CI: [min, max])
- **Guardrails**: No negative impact on cancellations or support tickets.
- **Decision**: Promoted to default / Abandoned.
- **Reusable Learning**: ...
```
