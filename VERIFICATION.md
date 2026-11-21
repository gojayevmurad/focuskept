# Verification report

Verified locally on 16 October 2026 (Asia/Baku). This report distinguishes deterministic local validation from remote service configuration. It is not a declaration of production readiness.

| Check                            | Actual result                                                      |
| -------------------------------- | ------------------------------------------------------------------ |
| Strict TypeScript                | PASS                                                               |
| ESLint                           | PASS                                                               |
| Unit tests                       | 34 passed                                                          |
| PostgreSQL integration tests     | 6 passed; 1 harness-only case skipped in the standalone suite      |
| Playwright E2E                   | 5 passed, including the otherwise-skipped paid fixture harness     |
| Production Next.js build         | PASS inside the final ARM64 Docker build                           |
| ARM64 Docker image               | PASS, `launchpad:reuse-verification`                               |
| Explicit image migration runner  | PASS, `Migrations applied` against isolated PostgreSQL             |
| Container startup                | PASS, runtime user `nextjs`                                        |
| Docker health check              | PASS, `healthy`                                                    |
| Application health               | HTTP 200, `{"status":"ok","database":"connected"}`                 |
| Production Compose validation    | PASS, `docker compose ... config --quiet`                          |
| Deployment script syntax         | PASS                                                               |
| Rollback tests                   | PASS, simulated failed startup restores the prior validated digest |
| Dependency audit                 | No known vulnerabilities found after patched tooling override      |
| Desktop/mobile visual inspection | PASS; inspected 1440px and 390px screenshots                       |
| Mobile horizontal overflow       | None at 390px                                                      |

## What the tests exercise

Unit tests cover redirect validation, mutation origins, password/email validation, environment failure modes, expired/missing entitlements, subscription policy, immutable deployment references, and rollback on startup failure.

Integration tests use a dedicated PostgreSQL 18.6 database with a name ending in `_test`. They apply real SQL migrations; verify signed and unsigned webhook handling; deduplicate delivery; reconcile stale payloads against mocked authoritative state; deny customer mismatches; check rollback of incomplete event writes; and exercise analytics consent, transactional outbox insertion, stable event identifiers and ingestion retry. The provider network boundary is mocked deterministically; signature verification and database writes are real.

Browser tests cover landing/pricing/registration navigation, protected-dashboard redirection, responsive overflow, theme switching, email registration and local verification, login, profile updates, free-user denial, Pro access through a signed fixture webhook, password change, logout, and email-based password reset. The paid-access harness runs in a separate test process against the isolated database and mocks only provider lookup; no production test endpoint or bypass is installed.

The test database uses a disposable Docker tmpfs volume. Real production data was not accessed. The container health test uses nonfunctional email credentials solely to satisfy production configuration validation; no email was sent.

## NOT VERIFIED

- Real Polar sandbox checkout, portal, renewal, failed-payment and full/partial-refund policies. Configure sandbox credentials/products/benefits and run the checklist in BILLING.md.
- Real Google OAuth callback and provider account linking.
- Resend delivery/domain reputation; PostHog ingestion/dashboards; Sentry event delivery, performance data and source-map upload.
- GitHub-hosted Actions execution, GHCR publication, protected environment approvals, SSH/VPS deployment, public DNS/TLS and central Caddy routing.
- Live rollback, backup restore, load behavior, production cookie/proxy configuration and jurisdiction-specific legal review.

## Known tradeoffs

Entitlements have a 15-minute lease; revocation can lag without webhook delivery. Expired leases fail closed when provider reconciliation fails. Connected or pending billing customers require reviewed support-assisted deletion. Analytics retries depend on webhook redelivery; there is no background worker. Product-defined onboarding/core actions are typed extension points. Legal pages and example price labels require customization.

ESLint 9.39.5 is deprecated upstream but retained because Next.js's bundled plugin dependency ranges do not yet support ESLint 10. The dependency audit found no known vulnerabilities. Revisit this pin when upstream compatibility improves. The template keeps pnpm 11.21.0 for reproducibility rather than introducing a package-manager major migration.

Earlier checks exposed and corrected sandbox port/font access, missing browser installation, a form label mismatch, dependency build-script approval, and a migration-runner packaging issue. The table reports the final successful runs, not those intermediate failures.

## Template reuse and deployment audit (16 October 2026)

The prior foundation used shared development database defaults, no initializer, a fixed SSH deployment directory, manual-only releases and an assumed GitHub environment approval capability. The revised implementation keeps the same application and provider architecture:

- `pnpm setup` initializes names, brand tokens, domains, ports and an explicit GitHub repository. Tested through the actual pinned pnpm CLI, including `pnpm setup -- --name ...` and `pnpm run setup --name ...`.
- Two independent temporary template copies received separate local/production credentials, Compose identities, proxy aliases and persistent volume names. Setup reruns preserved existing secrets; partial bundles and unsafe inputs were rejected.
- A fresh generated local project built and ran both Next.js and PostgreSQL in Docker. Its explicit local migration passed, health returned 200 with the database connected, and a written fixture survived a database restart.
- Both generated production Compose configurations validated with no published application/database ports and the existing external proxy plus an internal per-product database network.
- Unit coverage includes failed image pulls, startup/health failure rollback, first-deploy failure, same-digest redeploy history, explicit rollback, and cross-project image rejection. Deploy never executes migrations, database recreation or volume deletion.
- GitHub workflows passed `actionlint`; deployment shell syntax passed. Production selects an exact successful current-main commit associated with a merged PR, builds ARM64, deploys by digest, and checks freshness again after approval. Native protected mode verifies the actual reviewer rule; unsupported configurations fail closed. Manual mode requires an allowlisted operator and never auto-deploys.
- The updated ARM64 production image built successfully; its bundled migration command passed on the disposable local database. Runtime UID was 1001, Docker health was healthy and the endpoint returned 200. Neither `.env.local` nor generated runtime secrets existed in the image.
- Final TypeScript, lint, 34 unit, 6 integration and 5 E2E tests passed. One harness-only integration case is skipped in standalone integration runs and exercised by the E2E paid-access flow. Formatting and diff whitespace checks passed.

The repository has no configured Git remote. The actual account plan, repository visibility/protection settings, GitHub API token permissions, workflow dispatch/reviewer execution, GHCR publishing and SSH/VPS deployment remain **NOT VERIFIED**. Plan constraints were checked against current official GitHub documentation; no protection capability was assumed or enabled remotely. No live server, central Caddy, production database or existing user volume was modified. Temporary verification containers were stopped without deleting their database volumes.
