# Analytics

Product analytics use PostHog and are off unless `ANALYTICS_ENABLED=true` and `NEXT_PUBLIC_POSTHOG_KEY` are set. Even then nothing is captured until the person allows it: the consent banner and Settings store the choice locally and on the account. Autocapture, page views and session recording are disabled. People are identified by internal id, never by email. Withdrawing consent deletes queued billing events.

## Events

| Event                  | Sent when                                            |
| ---------------------- | ---------------------------------------------------- |
| `signup`               | Account created (browser)                            |
| `onboarding_completed` | Onboarding saved (server)                            |
| `booking_created`      | A booking is created (server)                        |
| `session_matched`      | A person first joins a matched session room (server) |
| `session_completed`    | The worker closes a session the person attended      |
| `session_quality`      | The room sends WebRTC stats when someone leaves      |
| `upgrade_started`      | Checkout created (server)                            |
| `upgrade_completed`    | Polar confirms an active subscription (webhook)      |
| `referral_sent`        | Invite link copied                                   |
| `referral_converted`   | An invited person finishes their first session       |
| `share_card_created`   | A share card is downloaded or shared                 |

These map to the metrics we track: activation (sessions in the first 24 hours), match rate (also shown in the admin panel from our own tables), W4 retention, free to Plus conversion, sessions per user per week and the referral K-factor.
