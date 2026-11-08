# Architecture

One Next.js 16 App Router application, one PostgreSQL database, one Docker image (plus a tiny scheduler container running from the same image). No queues, Redis, teams, RBAC, generic repositories or plugin framework.

## Request flow

- `proxy.ts` (Next 16's middleware) handles locale routing with next-intl: `/` redirects to the browser language, every page lives under `/[locale]`.
- Server Components read data directly through feature query helpers (`src/features/*/server.ts`). Protected pages call `requireSession`; layouts and navigation are never the authorization boundary.
- Mutations go through route handlers in `app/api/*`. Each one uses `requireApiUser` (session + exact same-origin check on non-GET), `readJson` (size limit + zod schema) and passes `userId` into every query, so ownership is enforced in the `WHERE` clause. Expensive endpoints add `limitOrReject` (PostgreSQL-backed rate limit).
- Client Components are limited to interactive surfaces: the focus timer, task boards, the explain/question editor, the review flow, settings forms, consent and language switching.

## Features (`src/features/`)

| Feature         | Responsibility                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `techniques`    | Typed registry of the 18 techniques, rule-based recommendation, localized content loader                  |
| `timer`         | Pure timer engines (fixed cycles, Flowtime, timebox, Deep Work, custom) — no React, fully unit-tested     |
| `focus`         | Focus screen, worker-driven ticker, procedural sounds, notifications, local (anonymous) and remote stores |
| `sessions`      | Saving sessions (idempotent by client id, clock-skew tolerant), streaks                                   |
| `tasks`         | Tasks/projects, frog, 1-3-5 slots, Eisenhower quadrants, Ivy Lee list with rollover                       |
| `import`        | One-time import of anonymous device data after sign-up                                                    |
| `cards`         | Learning drafts, Feynman explanation, AI analysis, question editor, knowledge cards                       |
| `subjects`      | Subjects that group Learning sessions and cards, so reviews can run per subject                           |
| `reviews`       | Spaced-repetition scheduler (pure), grading (rules, AI, self-grade), review flow                          |
| `limits`        | Free/Pro rules (20 cards, 10 AI analyses a month, Pro fair use, daily token budget), upgrade cards        |
| `notifications` | Cron jobs (digest, weekly report, streak nudge, cleanup), email templates, web push, unsubscribe tokens   |
| `stats`         | Stats queries, Lab (technique ranking by own ratings), Pro depth gating                                   |
| `preferences`   | Time zone, locale, week start, review steps, reminders; first-visit detection                             |
| `export`        | `GET /api/export` — JSON (everything) and CSV (sessions, cards, reviews)                                  |
| `legal`         | Privacy/terms/about pages from `content/legal/<locale>.json`                                              |
| `analytics`     | Server-side capture of authoritative product events                                                       |

## Data model

Drizzle schema in `src/lib/db/schema.ts`, SQL migrations in `drizzle/` (applied explicitly with `pnpm local:migrate` / the bundled `scripts/migrate.cjs`). Product tables: `user_preferences`, `project`, `subject`, `task`, `focus_session`, `learning_draft`, `learning_item` (knowledge card + schedule), `question`, `review`, `review_answer`, `ai_usage`, `ai_daily_usage`, `notification_log`, `push_subscription`, alongside the auth, billing, analytics-outbox and rate-limit tables. Every product row carries `user_id` with `ON DELETE CASCADE`, so account deletion removes everything (integration-tested). Dates that matter to the user ("today", due dates, streaks) are computed in the user's time zone (`src/lib/dates.ts`).

## Spaced repetition

`src/features/reviews/scheduler.ts` is a pure function: steps default to day 5/10/30 (user-configurable), then 60 days doubling to a 180-day cap. A review passes only when every answer is correct; a miss schedules a relearn in 2 days at the same step. Practice reviews before the due date never move the schedule. Tests cover custom steps, overdue cards, time-zone boundaries and DST.

## AI (`src/lib/ai/`)

OpenAI (`AI_MODEL`, default `gpt-4.1-mini`) with structured outputs: every response is parsed with a strict zod schema (`schemas.ts`). One retry on invalid output, the whole call bounded by `AI_TIMEOUT_MS`. User text is wrapped in tags it cannot close (`prompts.ts`) and the system prompt treats it as data, never instructions. Usage is recorded per call (`ai_usage`) and checked before work starts: Free 10 analyses/month, Pro fair use (`PRO_MONTHLY_AI_CARDS`), an optional global daily token budget (`AI_DAILY_TOKEN_BUDGET`) as a kill switch. Without a key, or on any failure, the UI falls back to manual questions and self-grading. No user text is logged or sent to analytics or Sentry.

## Background jobs

`scripts/scheduler.mjs` runs as its own container from the app image, holds only `CRON_SECRET`, and every 15 minutes POSTs to `/api/cron/{review-digest,weekly-report,streak-nudge}` (cleanup once a day) over the private `jobs` network. Each job is idempotent: a unique row per user/kind/day in `notification_log` is claimed before sending, so concurrent or repeated calls send at most once (integration-tested), with up to three retries for failed sends. Emails are React Email templates rendered in the recipient's saved locale; web push uses VAPID.

## Internationalization

24 locales (`src/i18n/config.ts`); RTL `dir` for ar, fa, ur with logical CSS properties throughout (a unit test guards against physical classes). UI strings in `messages/<locale>.json` (ICU messages, CLDR plural categories), technique guides and legal drafts in `content/`. `pnpm i18n:check` verifies keys, placeholders, tags, plural categories, untranslated English (reviewed exceptions in `messages/i18n-identical.json`), never-translate glossary terms, content list lengths and SEO lengths. Fonts: Geist for Latin/Cyrillic/Vietnamese, `next/font` Noto Sans for Greek, Arabic and Devanagari, self-hosted Noto Sans JP/KR/SC attached only on their locales after load.

## Billing

Polar (merchant of record) monthly and yearly Pro; the lifetime product stays hidden. Entitlements come only from verified webhooks and server-side reconciliation; every Pro-gated server path checks the entitlement, never a client value.

## PWA and offline

`public/sw.js` (hand-written) caches public pages — landing, `/focus` and technique pages — for offline use and handles web push; signed-in app pages are never cached. The timer ticks in a Web Worker and keeps its state in local storage, so a running session survives reloads and offline periods. Signed-in users' sessions recorded offline go to a local outbox and sync when the browser is back online.

## Configuration

`src/config/env.ts` validates runtime configuration; production refuses to start without HTTPS, a strong `BETTER_AUTH_SECRET` and real email sending. Integrations (OpenAI, Polar, Resend, PostHog, Sentry, VAPID, Google) stay off until configured. `NEXT_PUBLIC_*` values are compiled into the client bundle at build time. All variables are listed in `.env.example` and [DEPLOYMENT.md](DEPLOYMENT.md).

## Analytics

PostHog, off until `NEXT_PUBLIC_POSTHOG_KEY` is set. The client starts only after the visitor consents. Topics, notes, explanations, answers, task titles and other user text are never sent.

## Dependencies

Better Auth owns sessions, cookies, verification and resets. Dependencies are pinned and the lockfile is tracked. ESLint stays on 9.x until the Next.js plugin supports ESLint 10.
