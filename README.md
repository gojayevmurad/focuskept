# Launchpad

A reusable, single-product Next.js SaaS foundation. Public pages work without credentials. Accounts require PostgreSQL; billing stays disabled until configured. No simulated payment is treated as successful.

## Quick start

Use Node 24 LTS and pnpm 11.21.0. Create a repository from this GitHub template, then:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm setup
pnpm local:up
pnpm local:migrate
```

`setup` generates branding, a unique Compose identity, slug-derived default port ranges and independent local/production credentials. The pinned pnpm 11 supports `pnpm setup`; for arguments use `pnpm setup -- --name ...` or `pnpm run setup --name ...`. See [START_NEW_SAAS.md](START_NEW_SAAS.md) for the concise Azerbaijani guide, first provisioning and daily deployment.

Both Next.js and PostgreSQL run in Docker by default. Open the URL printed by setup. Register, run `pnpm email:inbox`, open the verification URL, and sign in. The local inbox contains sensitive short-lived links; it has no public HTTP endpoint. Preview mode never sends real mail. `pnpm local:stop` retains database volumes. For host-side Next.js, stop the Docker app first and use `pnpm dev` with the same generated configuration.

## Commands

| Command                 | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| `pnpm setup`            | Initialize branding, domains and isolated configuration |
| `pnpm local:up`         | Start Next.js and PostgreSQL in Docker                  |
| `pnpm local:migrate`    | Explicit local migration inside Docker                  |
| `pnpm local:stop`       | Stop local containers, keep volumes                     |
| `pnpm dev`              | Local application                                       |
| `pnpm typecheck`        | Strict TypeScript                                       |
| `pnpm lint`             | ESLint                                                  |
| `pnpm test`             | Unit tests                                              |
| `pnpm test:integration` | Webhook and optional isolated database tests            |
| `pnpm test:e2e`         | Browser tests                                           |
| `pnpm build`            | Production standalone build                             |
| `pnpm db:generate`      | Generate SQL for review                                 |
| `pnpm db:migrate`       | Explicit migration execution                            |
| `pnpm email:inbox`      | Development verification/reset URLs                     |
| `pnpm format`           | Format source                                           |

Stop an existing server on port 3000 before browser tests; Playwright starts its own isolated application. For complete database tests:

```sh
pnpm local:test-db
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
```

Integration tests load the local test URL and apply version-controlled migrations to the `_test` database only. The E2E wrapper explicitly points the application to that same isolated test database. Never configure test URLs against production. The test database is disposable (tmpfs). Without a configured test database, database-dependent integration cases are explicitly skipped. CI supplies its own ephemeral test database without setup secrets.

## What is included

- Email/password authentication, verification, password resets, optional Google login, sessions, profile/security settings, and guarded deletion.
- Polar sandbox checkout, customer portal/cancellation, signed webhooks, transactional event deduplication, and authoritative entitlement reconciliation.
- Consent-gated PostHog helpers, Pino JSON logs, Sentry client/server capture.
- Responsive landing, pricing, auth, dashboard, billing, settings, and a server-protected premium sample.
- Drizzle SQL migrations, Docker standalone image, private PostgreSQL networking, GHCR workflows, health verification and rollback script.

## Repository map

```text
app/                 App Router pages and HTTP endpoints
src/components/      Shared interface and shadcn-style owned primitives
src/config/          Branding and validated runtime configuration
src/lib/auth/        Better Auth and server session helpers
src/lib/billing/     Provider boundary, transactions and entitlement policy
src/lib/db/          PostgreSQL connection and explicit Drizzle schema
src/lib/email/       Resend and React Email
src/lib/analytics/   Typed, consent-aware tracking helpers
src/lib/security/    Validation and origin checks
drizzle/             Reviewed SQL migrations and snapshots
tests/               Unit, integration and Playwright tests
deploy/              Production Compose and rollout script
.github/workflows/   PR quality and approved production deployment
```

See [START_NEW_SAAS.md](START_NEW_SAAS.md), [ARCHITECTURE.md](ARCHITECTURE.md), [BILLING.md](BILLING.md), [ANALYTICS.md](ANALYTICS.md), [SECURITY.md](SECURITY.md), [DEPLOYMENT.md](DEPLOYMENT.md), [INIT_PROMPT.md](INIT_PROMPT.md), and [VERIFICATION.md](VERIFICATION.md).

## Before launch

Set product branding and support contact, replace legal placeholders and illustrative prices, configure verified email delivery, connect sandbox billing and test its complete lifecycle, configure consent and monitoring, run CI, back up PostgreSQL and rehearse restore/rollback. The repository is a foundation, not a certification of production readiness.
