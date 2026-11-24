# Architecture

FocusKept is a virtual coworking app. People book a time, get paired with a partner (or join a hosted group), say what they will work on, work quietly on camera, and report back at the end.

It is built on our Next.js SaaS boilerplate. Everything the boilerplate already does (auth, database, billing, email, analytics, logging, Docker, CI) is reused as is and extended in place.

## What the boilerplate gives us

| Area      | Implementation                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework | Next.js 16 App Router, React 19, TypeScript strict. `output: "standalone"`.                                                                                                    |
| Auth      | Better Auth (`src/lib/auth`): email + password with verification and reset, optional Google OAuth, DB-backed sessions and rate limits. `requireSession()` guards pages.        |
| Database  | PostgreSQL 18 + Drizzle ORM (`src/lib/db`). SQL migrations in `drizzle/`, applied explicitly (`pnpm db:migrate`, or the bundled `scripts/migrate.cjs` in the image).           |
| Billing   | Polar (`src/lib/billing`). Checkout, customer portal, signed webhooks, advisory-locked reconciliation into `subscription` + `entitlement` (15 minute lease, fails closed).     |
| Email     | Resend + React Email (`src/lib/email`). `EMAIL_MODE=preview` stores mail in `email_preview` for local work (`pnpm email:inbox`).                                               |
| Analytics | PostHog, consent-gated on the client and the server. Billing events go through a transactional outbox.                                                                         |
| Ops       | Pino JSON logs with redaction, Sentry, `/api/health`, Docker multi-stage image, Compose for local and production, GHCR + SSH deploy workflow with digest pinning and rollback. |
| UI        | Plain CSS tokens in `app/globals.css` + Tailwind 4, lucide icons, a small owned `Button`.                                                                                      |

The boilerplate deliberately has no queues, Redis or custom server. We add one background worker (see below) and keep the rest.

## What we add

```text
app/[locale]/(marketing)/   Landing, pricing, how it works, FAQ, blog, programmatic SEO pages
app/[locale]/(app)/         Dashboard, calendar, session room, profile, settings, admin
app/[locale]/u/[username]   Personal booking link
app/api/                    Route handlers (bookings, sessions, realtime, video, account, webhooks)
src/i18n/                   next-intl routing and request config
src/config/                 env (validated), app config (brand, feature flags), brand tokens
src/config/brand-assets.ts  Browser-safe logo geometry, kit colors and asset URLs (no env)
src/lib/brand/              next/og helpers: local fonts, mark, card layout pieces
src/lib/email/              Sending, preview inbox, email identity (brand.ts)
src/lib/scheduling/         Slot math (UTC :00/:30), week windows, popular times. Pure.
src/lib/matching/           Pairing algorithm (pure) and the DB runner used by the worker
src/lib/bookings/           Create, cancel, limits, direct bookings
src/lib/sessions/           Session lifecycle, goals and outcomes, room access checks
src/lib/realtime/           Postgres LISTEN/NOTIFY bus and Server-Sent Events
src/lib/video/              Provider interface + Cloudflare Realtime and LiveKit adapters
src/lib/notifications/      Email templates, web push, idempotent send log
src/lib/safety/             Blocks, reports, suspension, API rate limiting
src/lib/growth/             Referrals, streaks and stats, share cards, challenges, groups
src/lib/hosts/              Host applications, group sessions, ratings, host perks
src/lib/billing/plan.ts     Plan resolution on top of the boilerplate entitlement
worker/                     pg-boss worker process (matching, fallbacks, reminders, completion)
content/                    SEO data and blog posts (hosted site only)
messages/                   next-intl message catalogs
brand/                      Identity kit: sources, tokens, fonts, exports (pnpm brand:generate)
```

### Processes

One Docker image, two processes:

- `web`: `node server.js` (Next.js standalone).
- `worker`: `node worker.cjs`, a bundled pg-boss worker. It owns everything time based: matching at T-5, fallback offers at T-2, reminders at T-10, marking sessions completed or no-show, monthly host perks and the Cloudflare usage check.

Both talk to the same PostgreSQL. pg-boss keeps its tables in the `pgboss` schema. No Redis.

### Realtime

`src/lib/realtime` keeps one `LISTEN realtime` connection per web process and fans messages out to subscribers in memory. Anything (a route handler or the worker) publishes with `pg_notify('realtime', json)`. Browsers get events over SSE (`/api/realtime`). Topics are `user:<id>` (matched, partner changed, fallback offer) and `session:<id>` (presence, published tracks, goals, outcomes). Payloads are small and never carry secrets; clients refetch state over normal endpoints on reconnect.

This assumes a single web replica. Running several replicas still works because NOTIFY reaches every listener.

### Video

All video code lives in `src/lib/video`. The UI only knows the interface:

```ts
// server side
createRoom(session) -> { roomId }
issueJoin(room, participant) -> JoinCredentials

// browser side
join(credentials) / publishTracks(...) / subscribe(participant) / setMicrophone(on)
setRemoteVideo(on) / getStats() / leave()
```

`VIDEO_PROVIDER` selects the adapter:

- `cloudflare` (hosted). Cloudflare Realtime is a bare SFU with no rooms. Our backend creates one Realtime session per participant, proxies push/pull/renegotiate calls with the app token (never sent to the browser), and stores the Realtime session id and track names on `session_participant`. A participant can only pull tracks of people in the same focus session; the check is in the route handler. TURN credentials are short lived and issued by the backend.
- `livekit` (self-hosting). LiveKit rooms map 1:1 to focus sessions; the backend signs access tokens. `docker compose --profile livekit up` runs a LiveKit server.
- `none` (development and tests only, refused in production). Shows the local camera, no transport.

Quality defaults: 640x480, about 600 kbps, 15–24 fps, dropping to 360p and 300 kbps when the connection struggles. Opus audio with noise suppression; muting stops sending audio. Remote video is paused while the tab is hidden. After each session the browser sends a stats summary (RTT, loss, bitrate, relay used) which is stored on the participant and sent to PostHog as `session_quality` when the user allowed analytics.

### Scheduling and matching

- Sessions start only at :00 and :30 UTC and last 25, 50 or 75 minutes. Every time is stored in UTC; the user's IANA timezone is used only for display, day boundaries (streaks) and week boundaries (free limit).
- A booking is `booked` until the worker pairs it at T-5 (`matched`). Pairing is a pure function: never pair blocked users, prefer mutual preferred partners, then favorites, then shared groups, then shared segments, then anyone, oldest bookings first.
- A booking made after T-5 is matched on the next worker tick (every minute) or instantly on creation.
- Anyone still alone at T-2 gets a fallback offer: the open group room for that start time, the next slot with someone waiting, or cancelling without penalty. Each unmatched booking is recorded in `match_failure` to measure the match rate.
- Cancelling is free up to 1 hour before the start. Later cancellations become `late_cancel`; a matched participant who never joins becomes `no_show`. If a partner drops after matching, the other person is put back into the pool and told.

### Plans

`getPlan(userId)` resolves to `plus` when any of these is true: billing is disabled (`BILLING_ENABLED=false`), the Polar entitlement is active (this covers the 7 day trial, which is configured on the Polar product), the user is a house account, an approved host earned the monthly perk, or the user belongs to a group with an active licence. Otherwise `free`: 3 sessions per week, no favorites, no advanced filters. Prices live in Polar only.

### Configuration and self-hosting

Hosted and self-hosted builds are the same code. Differences come from env: `BILLING_ENABLED`, `VIDEO_PROVIDER`, `ANALYTICS_ENABLED`, `SIGNUPS_MODE` (`open | invite | closed`), `MARKETING_ENABLED`, `APP_NAME`, `APP_URL`, `LOGO_URL`, `SUPPORT_EMAIL`. Branding is never hard-coded. See `SELF_HOSTING.md`.

### i18n

next-intl with locale-prefixed routes (`localePrefix: "as-needed"`), so English stays at `/` and later locales get `/de`, `/fr`, `/nl`, `/es` plus `hreflang`. All UI strings live in `messages/<locale>.json`. API routes are not localized.

## Data model

Boilerplate tables (`user`, `session`, `account`, `verification`, `rate_limit`, `billing_customer`, `subscription`, `entitlement`, `processed_event`, `email_preview`, `app_config`, `analytics_outbox`) are unchanged. New tables, all keyed to `user.id`:

| Table                                   | Purpose                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `profile`                               | username, display name, avatar, locale, timezone, bio, segments, referral code, referred by, 18+ confirmation, role |
| `booking`                               | one row per person per slot: start (UTC), duration, status, preferred partner, session                              |
| `focus_session`                         | a pair or group session: start, duration, type, host, video room id, status                                         |
| `session_participant`                   | goal, outcome, join/leave times, video session id, quality stats                                                    |
| `favorite`, `block`, `report`           | partner relationships and safety                                                                                    |
| `match_failure`                         | unmatched bookings, for the match-rate metric                                                                       |
| `notification_log`, `push_subscription` | idempotent reminders and web push endpoints                                                                         |
| `referral`                              | referrer, referee, status, reward                                                                                   |
| `challenge`, `challenge_member`         | time-boxed goals with leaderboards                                                                                  |
| `community`, `community_member`         | universities, bootcamps, companies (named "community" because `group` is an SQL keyword)                            |
| `host`, `host_rating`                   | host programme                                                                                                      |

Auth already owns a table called `session`, so focus sessions are `focus_session`.

## Security

- Every route handler checks the session and same-origin on mutations, then authorizes the specific resource (booking owner, session participant, admin role). Layouts are never an authorization boundary.
- Video credentials, Polar tokens and TURN keys stay on the server. The browser only ever receives short-lived tokens scoped to one session.
- Safety rules (blocks, reports, rate limits, suspension) are enforced in code paths that ship with the open source build; nothing relies on hidden configuration.
- CI runs gitleaks on every push and pull request.

## Open source review (phase 1)

Checked on 21 November 2026 before any product code was written.

- **Boilerplate licence.** The boilerplate is our own private template with no third-party code beyond npm dependencies and the `create-next-app` scaffold (MIT). We own it, so it can be published under AGPL-3.0.
- **Company code, internal URLs, keys, customer data.** None found. `gitleaks` reports no leaks in the history; manual search for IPs, internal hostnames, tokens and email addresses found only localhost, `0.0.0.0` bind addresses and an obviously fake test webhook secret. Generated secrets live in gitignored `.env.local` and `deploy/generated/`.
- **Dependency licences** (`pnpm licenses list --prod`): MIT, Apache-2.0, ISC, BSD-2/3, BlueOak, 0BSD, CC0, MIT-0, Unlicense, MPL-2.0 (lightningcss, dompurify), LGPL-3.0 (`@img/sharp-libvips`, dynamically linked), CC-BY-4.0 (caniuse data). All are compatible with distributing this project under AGPL-3.0. One build-time package, `sentry` (FSL-1.1-Apache-2.0, pulled in by `@sentry/nextjs` for source-map upload), is source-available rather than open source. We do not vendor or modify it, and it only restricts offering a competing Sentry service, so it does not conflict with our licence. Self-hosters can drop Sentry entirely.

No blocking issues, so the repository can be made public once the first phase passes CI.
