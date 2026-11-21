# Progress

Status as of 21 November 2026. "Not verified" means it needs real credentials or the production server.

## Phase 1: Foundation

- [x] Repository recreated from the boilerplate, `pnpm setup` run
- [x] Boilerplate reviewed, `ARCHITECTURE.md` with the open source review
- [x] Config and feature flags (`BILLING_ENABLED`, `VIDEO_PROVIDER`, `ANALYTICS_ENABLED`, `SIGNUPS_MODE`, `MARKETING_ENABLED`, branding)
- [x] i18n with next-intl, locale-prefixed routes
- [x] Database schema and migrations
- [x] Profile, 18+ confirmation, onboarding with a first booking
- [x] Docker image with web and worker, Compose for local and production, optional LiveKit profile
- [x] CI: typecheck, lint, unit, integration, build, browser tests, SPDX check, gitleaks
- [x] LICENSE (AGPL-3.0), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CLA and CLA workflow, issue and PR templates, Dependabot

## Phase 2: Core loop

- [x] Weekly calendar in the user's time zone with demand per slot and popular hours
- [x] Bookings: limits, overlap protection, free cancellation until T-60, late cancels and no-shows
- [x] pg-boss worker: matching at T-5, fallback offers at T-2, reminders at T-10, completing sessions
- [x] Pairing algorithm with tests (blocks, preferences, favorites, groups, segments, odd counts, DST)
- [x] Realtime over SSE backed by Postgres LISTEN/NOTIFY
- [x] Session room: camera required, mic optional, timer and phases, chimes, goals, outcomes
- [x] Video module behind one interface: Cloudflare Realtime, LiveKit, and a local-only `none`
- [x] Report and block, auto-pause after repeated reports
- [x] Email and web push notifications
- [ ] Cloudflare Realtime with real credentials (not verified)

## Phase 3: Money, SEO, legal, deploy

- [x] Free plan (3 sessions a week) and Plus through Polar, prices read from Polar
- [x] 7 day trial configured on the Polar products (see DEPLOY.md)
- [x] Marketing pages, FAQ, blog, 34 programmatic SEO pages, sitemap, robots, JSON-LD, OG images
- [x] GDPR: consent-gated analytics, data export, account deletion, Privacy Policy and Terms
- [x] `BILLING_ENABLED=false` mode and `SELF_HOSTING.md`
- [x] `DEPLOY.md`, backups, health check with worker heartbeat
- [ ] Polar sandbox checkout end to end with real sandbox keys (not verified; webhook path is covered by tests)
- [ ] First production deploy (waiting for the owner's go-ahead: the server still runs the previous app)
- [ ] Lawyer review of the legal pages

## Phase 4: Growth

- [x] Personal booking link `/u/<username>` with direct bookings and invitations
- [x] Referrals with a free Plus month for both sides via Polar discounts
- [x] Daily and weekly streaks, focus hours, activity chart
- [x] Share cards (1080x1920 and 1080x1080)
- [x] Challenges with leaderboards
- [x] Groups with invite links and matching priority

## Phase 5: Hosts, B2B, admin, self-hosting

- [x] Host applications, group sessions up to 9, host controls in the room, ratings, host pages
- [x] Monthly host perk (free Plus)
- [x] Group licences managed by admins
- [x] Admin panel: metrics, users, reports, hosts, challenges, groups, house account
- [x] LiveKit adapter and `docker compose --profile livekit`

## Phase 6: Europe

- [x] European popular hours for people in European time zones
- [ ] de, fr, nl, es translations
- [ ] Localized SEO pages and hreflang
