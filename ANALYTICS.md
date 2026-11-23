# Analytics

FocusKept product analytics use PostHog and are controlled by the runtime master switch `ANALYTICS_ENABLED=true` alongside `POSTHOG_KEY`. Runtime configuration is read on the server (`src/config/env.ts` and `src/config/app.ts`) and delivered to the client via `AnalyticsProvider` in the root locale layout, avoiding build-time environment variable inlining in Docker images.

---

## Two-Level Tracking

1. **Before consent or after "reject" (Cookieless Mode)**:
   - Uses PostHog's cookieless mode (`cookieless_mode: "on_reject"`, `opt_out_capturing_by_default: true`).
   - Anonymous: no cookies, local storage, or device identifiers are written or persisted.
   - Captures `$pageview` and `$pageleave` across App Router navigations (`capture_pageview: "history_change"`, `capture_pageleave: true`).
   - UTM campaign parameters and external referrer hosts are included statelessly.
   - No person profiles are created for anonymous visitors (`person_profiles: "identified_only"`).
   - Performance metrics (Web Vitals) and exception auto-capture remain inactive until consent is granted.

2. **After consent**:
   - Opts in to full PostHog capturing (`opt_in_capturing()`).
   - Enables standard client-side persistence (`localStorage+cookie`).
   - Enables Core Web Vitals performance reporting (`capture_performance: { web_vitals: true }`) and unhandled exception capture (`capture_exceptions: true`).
   - Identifies users strictly by their internal database user ID (`user.id`), never by email or name.
   - User choices can be updated at any time in Account Settings or via the consent banner.

---

## Reverse Ingestion Proxy (`/ingest`)

To prevent browser ad-blockers and privacy extensions from silently dropping analytics events, a reverse proxy route is provided at `app/ingest/[...path]/route.ts`:

- Requests to `/ingest/static/*` are transparently proxied to the PostHog assets host (`POSTHOG_ASSETS_HOST`, default `https://us-assets.i.posthog.com`).
- All other requests to `/ingest/*` are proxied to the PostHog ingestion host (`POSTHOG_HOST`, default `https://us.i.posthog.com`).
- The proxy streams request and response bodies, strips sensitive domain cookies and authorization headers, and enforces a short timeout (10 seconds).
- The `/ingest` path is excluded from the next-intl locale middleware in `proxy.ts`.

---

## First-Touch Attribution (`fk_attr`)

First-touch attribution captures how a visitor discovered FocusKept before signing up:

- On the first page visit without an existing `fk_attr` cookie, `proxy.ts` issues a first-party cookie:
  - **Name**: `fk_attr`
  - **Attributes**: `SameSite=Lax`, `Path=/`, `Max-Age=7776000` (90 days), `Secure` (in HTTPS).
  - **Payload**: JSON containing `{ source, medium, campaign, content, term, ref, referrer, landingPath, firstSeenAt }`.
  - **Privacy**: The cookie contains zero user identifiers, personal data, or fingerprinting hashes.
- Known referrer hosts are mapped to a high-level acquisition channel via the pure function `channelFor(attribution)`:
  - **Organic Search**: `google.*`, `bing.*`, `duckduckgo.*`, `ecosia.*`, `yahoo.*`, or `utm_medium=organic`.
  - **AI Search**: `chatgpt.com`, `chat.openai.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`, `copilot.microsoft.com`.
  - **Social**: `reddit.com`, `x.com`, `t.co`, `twitter.com`, `linkedin.com`, `facebook.com`, `instagram.com`, `youtube.com`, `tiktok.com`, or `utm_medium=social`.
  - **Referral**: Other external referrers, referral codes (`?ref=`, `/r/<code>`, `/u/<username>`), or `utm_medium=referral`.
  - **Direct**: No referrer and no marketing parameters.
- When an account finishes onboarding (`app/[locale]/(app)/onboarding/actions.ts`), the `fk_attr` cookie data is validated, each field is truncated to at most 200 characters, stored into `profile.attribution`, and the cookie is deleted.
- The server event `onboarding_completed` sends `$set_once` person properties:
  - `initial_channel`, `initial_source`, `initial_medium`, `initial_campaign`, `initial_referrer`, `initial_landing_path`.
  - Optional `heard_from`: `tiktok`, `instagram`, `youtube`, `reddit`, `google`, `friend`, `podcast`, or `other`, from the skippable onboarding question. Also included as an event property. The optional Other free text is stored only in `profile.attribution` and is never sent to analytics.
- The browser `signup` event includes the computed `channel`.

---

## Event Taxonomy

All events follow `snake_case` object_action naming:

| Event                     | Origin        | Trigger                                    | Properties                                                                                                                     |
| ------------------------- | ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `cta_clicked`             | Client        | User clicked a marketing CTA               | `location`, `label`                                                                                                            |
| `signup_started`          | Client        | Sign-up page viewed                        | _(optional metadata)_                                                                                                          |
| `signup`                  | Client        | Account created via credentials or OAuth   | `channel`                                                                                                                      |
| `onboarding_completed`    | Server        | Profile onboarding saved                   | `segments`, `channel`, optional `heard_from` (enum only), `$set_once: { initial_*, heard_from }` (when answered; no free text) |
| `booking_viewed`          | Client        | Booking calendar opened                    | _(optional metadata)_                                                                                                          |
| `booking_created`         | Server        | Session booking scheduled                  | _(booking metadata)_                                                                                                           |
| `session_matched`         | Server        | User matched and room created              | _(session metadata)_                                                                                                           |
| `session_joined`          | Client        | Video room join confirmed                  | `sessionId`, `duration`                                                                                                        |
| `video_failed`            | Client        | WebRTC / video provider connection failed  | `reason` (code only, no PII)                                                                                                   |
| `session_completed`       | Server        | Worker closes completed session            | _(session metadata)_                                                                                                           |
| `session_quality`         | Client        | WebRTC stats emitted on room exit          | WebRTC audio/video quality metrics                                                                                             |
| `tour_started`            | Client        | Guided product tour started                | `tourName`                                                                                                                     |
| `tour_completed`          | Client        | Guided product tour finished               | `tourName`                                                                                                                     |
| `help_viewed`             | Client        | Help center or FAQ viewed                  | `topic`                                                                                                                        |
| `support_ticket_created`  | Client/Server | Support ticket submitted                   | `category`                                                                                                                     |
| `email_tips_unsubscribed` | Client/Server | User unsubscribed from tip emails          | _(optional metadata)_                                                                                                          |
| `upgrade_started`         | Server        | Checkout session created                   | `plan` (`monthly`, `yearly`, `lifetime`)                                                                                       |
| `upgrade_completed`       | Server        | Polar webhook confirms active subscription | `plan`                                                                                                                         |
| `referral_sent`           | Client        | Invite or profile link copied/shared       | _(optional metadata)_                                                                                                          |
| `referral_converted`      | Server        | Referred person finishes first session     | _(referral metadata)_                                                                                                          |
| `share_card_created`      | Client        | Share card generated/downloaded            | _(card metadata)_                                                                                                              |

### CTA Tracking Convention

Instead of manually adding tracking logic across marketing pages, any interactive element can declare CTA tracking declaratively:

- `data-cta="<label>"` (e.g. `data-cta="hero_start_free"`)
- `data-cta-location="<location>"` (defaults to `window.location.pathname` if omitted)

Alternatively, use the exported helper `trackCta(location, label)`.

---

## Legal & Privacy Reference (GDPR / ePrivacy)

For the legal compliance review:

1. **Consent Prior to Persistent Tracking**:
   - FocusKept does not set persistent tracking cookies or store distinct identifiers in `localStorage` prior to explicit user consent.
   - Cookieless mode operates strictly statelessly without device fingerprinting.
2. **Functional Attribution Cookie (`fk_attr`)**:
   - Stored under the legitimate interest / functional necessity of crediting referral partnerships and tracking top-level campaign efficacy.
   - Contains no persistent device identifier or personally identifiable information (PII).
   - Automatically cleared upon profile completion at onboarding, or expires after 90 days.
3. **No Third-Party Tracker Injection**:
   - PostHog runs exclusively through our first-party reverse proxy (`/ingest`), ensuring third-party scripts are not loaded directly from external ad domains.
   - IP addresses are never persisted in FocusKept's database.
4. **Data Minimization & Person Identification**:
   - Accounts are identified in PostHog solely via their internal database UUID (`user.id`).
   - Names, email addresses, and payment credentials are never sent to PostHog.
   - Video failure diagnostics transmit error classification reason codes only (e.g. `ice_connection_failed`), omitting error stacks or local IP candidates.
5. **Right to Withdraw Consent**:
   - Users can opt out anytime in Settings. Opting out immediately clears PostHog client persistence and returns the SDK to cookieless opt-out mode.
