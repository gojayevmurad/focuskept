# Self-hosting

The app ships as one ARM64 Docker image, with a reverse proxy in front and PostgreSQL on a private network. Before anything else, set your `domain`, `repository` and `deployPath` in `saas.config.json`. `pnpm setup` then generates the production `.env` and `runtime.env` in `deploy/generated/`, which is ignored by Git. Copy `compose.production.yaml` and `deploy.sh` from `deploy/`, plus those two files, to the server.

## Services

Defined in `deploy/compose.production.yaml`:

| Service     | Purpose                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| `app`       | Next.js standalone server, with a health check at `/api/health`               |
| `db`        | PostgreSQL, with no host port                                                 |
| `scheduler` | Same image. Calls `/api/cron/*` every 15 minutes and holds only `CRON_SECRET` |

## Environment variables

Runtime secrets go in `runtime.env`. `NEXT_PUBLIC_*` values are build arguments compiled into the image, so they are public. All are listed in `.env.example` and validated by `src/config/env.ts`.

| Variable                                                 | Required        | Notes                                               |
| -------------------------------------------------------- | --------------- | --------------------------------------------------- |
| `APP_URL`                                                | yes             | HTTPS is enforced in production                     |
| `DATABASE_URL`                                           | yes             | Private network URL to `db`                         |
| `BETTER_AUTH_SECRET`                                     | yes             | 32+ random characters; also signs unsubscribe links |
| `EMAIL_MODE`, `EMAIL_FROM`, `RESEND_API_KEY`             | yes             | `EMAIL_MODE=send`, with a verified Resend domain    |
| `REMINDER_EMAIL_FROM`                                    | recommended     | Sender for digests and reports                      |
| `CRON_SECRET`                                            | yes             | `openssl rand -hex 32`; same value in `.env`        |
| `OPENAI_API_KEY`                                         | for AI features | Without it the app offers manual questions          |
| `AI_MODEL`, `AI_TIMEOUT_MS`                              | no              | Defaults: `gpt-4.1-mini`, `30000`                   |
| `PRO_MONTHLY_AI_CARDS`                                   | no              | Pro fair-use cap, default 300                       |
| `AI_DAILY_TOKEN_BUDGET`                                  | recommended     | Global daily token cap; empty means no cap          |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for web push    | `pnpm exec web-push generate-vapid-keys`            |
| `POLAR_*`                                                | for billing     | See [Billing](#billing)                             |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`               | optional        | Google sign-in                                      |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `LOG_LEVEL`          | optional        | Monitoring and logging                              |
| `NEXT_PUBLIC_SITE_URL`                                   | build arg       | Canonical origin for SEO                            |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`    | build arg       | Analytics, only after visitor consent               |
| `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_RELEASE`   | build arg       | Browser monitoring                                  |

## Billing

Create a monthly product, a yearly product and one Pro benefit attached to both in Polar. Set their IDs, `POLAR_ENVIRONMENT`, `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET`.

- **Token scopes:** `checkouts:write`, `customer_sessions:write`, `customers:read`, `orders:read`.
- **Webhook:** `/api/webhooks/polar`, API version `2026-10`, events `customer.state_changed`, `order.paid`, `subscription.active`, `subscription.canceled`.

Pro access comes only from verified webhooks and server-side reconciliation.

## Releases

The `Release` workflow runs only when the `DEPLOY_ACTORS` variable is set, so forks and unconfigured copies skip it.

1. Every push to `main` that passes `Quality` builds an image and deploys it to staging by digest.
2. To promote, run **Actions → Release → Run workflow**. Production only receives an image that staging already ran.

It needs the secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS`, and the variables `DEPLOY_ACTORS`, `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_SENTRY_DSN`. On the server, pin the CI key to `deploy/ssh-deploy.sh` with `restrict,command="…"` in `authorized_keys`.

`deploy.sh` recreates `app` and `scheduler` and never touches `db`. If the health check fails, it restores the previous image. To roll back by hand, run `bash deploy.sh --rollback`.

## Migrations

Deploys never run migrations. After reviewing the SQL and taking a backup, run:

```sh
docker compose -f compose.production.yaml run --rm --no-deps app node scripts/migrate.cjs
```

## Backups

`deploy/backup.sh` runs from cron. It dumps each running database, keeps 7 copies locally and uploads to Cloudflare R2. To restore:

```sh
docker exec -i <project>-db-1 pg_restore -U <user> -d <db> --clean < file.dump
```
