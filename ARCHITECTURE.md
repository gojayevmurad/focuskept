# Architecture

One App Router application, one PostgreSQL database per independent product, one Docker image. No queues, Redis, teams, RBAC, generic repositories, or plugin framework.

Server Components call database/session helpers directly. Client Components are limited to forms, theme selection, consent and outbound checkout. API endpoints validate sessions independently. Protected pages call `requireSession`; navigation and layouts are not authorization boundaries. Authentication is instantiated lazily so static builds require no runtime secrets. Cookie headers are read before the optional configuration check, preserving dynamic protected routes.

## Boundaries

`src/lib/auth` owns Better Auth. `src/lib/billing/provider.ts` is the Polar adapter. `sync.ts` serializes writes per customer with PostgreSQL transaction advisory locks. `entitlements.ts` is the server-facing access API. Database tables use UTC-aware timestamps, foreign keys, unique identifiers and lookup indexes. No seed users or credentials are provisioned.

The pool has ten connections per application process and a five-second connection timeout. Budget VPS PostgreSQL connections across all products. Default single-instance Better Auth rate limits are persisted in PostgreSQL. For multiple application replicas, review atomic rate-limit guarantees before scaling.

Lists should use keyset pagination: `WHERE (created_at, id) < ($cursorTime, $cursorId) ORDER BY created_at DESC, id DESC LIMIT 50`, with a matching composite index. Do not add a generic repository just for pagination.

## Configuration

`src/config/env.ts` validates server configuration at runtime. Production requires PostgreSQL, HTTPS, a random authentication secret, and sending email. Integrations are off until configured. Public `NEXT_PUBLIC_*` values are compiled into bundles and require a rebuild; server secrets are injected at runtime. Production builds do not need runtime credentials. Source-map upload configuration is build-only.

Brand name and description live in `src/config/brand.ts`. Shared visual tokens live in `app/globals.css`. Route-specific copy is intentionally owned by the application. Legal and pricing content must be customized.

## Version decisions

Dependencies are pinned and the pnpm lockfile is tracked. Node 24 LTS, Next 16.4.2, React 19.3.1, Better Auth 1.7.8 and Polar SDK 1.0.2 were checked against installed declarations/registry. Polar uses the explicit `2026-10` API. React Email 6 uses imports from `react-email`; the old `@react-email/components` package is deprecated. Sentry 11 exports build configuration from `@sentry/nextjs/config`. PostgreSQL 18.6 is the stable release used in Compose. The legacy esbuild tooling path is overridden to a patched version; migration tooling is exercised separately.

Official references: [Next auth](https://nextjs.org/docs/app/guides/authentication), [Better Auth Drizzle](https://better-auth.com/docs/adapters/drizzle), [Polar SDK](https://github.com/polarsource/polar/tree/main/sdk/typescript), [React Email](https://react.email/docs/introduction), [PostgreSQL releases](https://www.postgresql.org/docs/release/).

## Deliberate tradeoffs

The app keeps the root `app/` convention from the existing starter and places reusable modules under `src/`. Billing benefits cover recurring and one-time access through a common entitlement. Deleting an account with any connected billing customer requires support review, preventing orphaned paid subscriptions. Entitlement leases expire after 15 minutes and refresh server-side; access fails closed if refresh fails. This can delay revocation by at most a lease interval. No zero-downtime claim is made.

ESLint is pinned to 9.39.5 because the official Next.js lint plugin dependencies do not yet declare ESLint 10 compatibility. npm marks ESLint 9 deprecated; dependency audit is clean, but revisit this pin when the upstream plugin compatibility ranges are updated.
