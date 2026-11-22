# Self-hosting FocusKept

FocusKept is an AGPL-3.0 Next.js application with a PostgreSQL database and a background worker. Both processes run from the same image.

## Requirements and quick start

Use a Linux server with Docker Engine and the Compose plugin, a domain, and an HTTPS reverse proxy. The supplied production Compose file expects a central Caddy on an external network named `proxy`. Production authentication requires a Resend account and verified sender: `EMAIL_MODE=send` uses Resend, not a generic SMTP server. For local development, email preview needs no provider.

Better Auth resolves client IPs for rate limiting from `cf-connecting-ip` first, then `x-forwarded-for`. Preserve Cloudflare's `cf-connecting-ip` header through Caddy when using Cloudflare; deployments without Cloudflare use Caddy's `x-forwarded-for` header.

1. Install Node 24 and pnpm 11 locally. Run `pnpm install --frozen-lockfile` and `pnpm setup`.
2. For local development run `pnpm local:up`, then `pnpm local:migrate`. This starts web, database and worker. Use `pnpm local:logs` for both process logs and `pnpm local:stop` to stop them. `VIDEO_PROVIDER=none` works only locally.
3. For production follow [DEPLOY.md](DEPLOY.md) to copy the generated bundle, configure runtime secrets, publish/pull an ARM64 image, provision PostgreSQL, run migrations and deploy. Builds for other server architectures must target that architecture explicitly.
4. Choose Cloudflare or LiveKit video below. Set `NODE_ENV=production`, `EMAIL_MODE=send`, an HTTPS `APP_URL`, and `BILLING_ENABLED=false` in `runtime.env`.
5. Route the domain to the web service with HTTPS, verify `/api/health`, schedule backups and monitor web and worker.

Generated files contain private credentials. Keep the server deployment directory mode 700, env files mode 600, and encrypted off-server backups. Setup preserves existing env files; review new variables after updates.

## Choosing video

### Cloudflare

Set `VIDEO_PROVIDER=cloudflare`. Create a Realtime SFU app and TURN key in the Cloudflare dashboard, then set their ID/token pairs. For usage checks also supply the Cloudflare account ID and an API token with Account Analytics read. See [DEPLOY.md](DEPLOY.md#cloudflare-realtime-setup). No video UDP/TURN ports are needed on your server.

### LiveKit

For local development:

```sh
docker compose --env-file .env.local --profile livekit up -d livekit
```

The dev server uses API key `devkey` and secret `secret`. Set `VIDEO_PROVIDER=livekit`, `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret`, and `LIVEKIT_URL=ws://localhost:7880` in `.env.local`, then recreate app and worker. Local TCP ports 7880/7881 bind to loopback; UDP uses port 7882. Never use dev credentials on a public server.

For production, generate a strong API key and secret and put the same values in `runtime.env` and the LiveKit configuration. Copy `deploy/livekit.example.yaml` to the server deployment directory. It is a template: mounted YAML is not interpolated by Compose. On Ubuntu, install `gettext-base` for `envsubst`, then render with the values you assigned in `runtime.env`:

```sh
umask 077
read -r -p 'LiveKit API key: ' LIVEKIT_API_KEY
read -rs -p 'LiveKit API secret: ' LIVEKIT_API_SECRET; echo
export LIVEKIT_API_KEY LIVEKIT_API_SECRET
envsubst '$LIVEKIT_API_KEY $LIVEKIT_API_SECRET' < livekit.example.yaml > livekit.yaml
unset LIVEKIT_API_KEY LIVEKIT_API_SECRET
chmod 600 livekit.yaml
export APP_IMAGE="$(cat .validated-image)"
docker compose --env-file .env -f compose.production.yaml --profile livekit up -d livekit
```

Use generated alphanumeric keys to avoid YAML quoting issues. Set `VIDEO_PROVIDER=livekit`, `LIVEKIT_URL=wss://livekit.<domain>` and the matching key/secret in `runtime.env`, then redeploy app and worker. The public WSS URL must be reachable by browsers and the application.

Point `livekit.<domain>` DNS at the server. Add a Caddy site for that hostname with `reverse_proxy <APP_PROXY_ALIAS>-livekit:7880`, substituting the actual alias. Port 7880 is available only through the proxy network; host networking is not used. Open and forward 7881/tcp and 50000–50200/udp on the host firewall/router, including any cloud firewall. The example enables external IP discovery. LiveKit's media ports must reach the server directly; an HTTP proxy does not carry them. Use DNS-only Cloudflare records for this hostname. This example does not configure a separate TURN service; restrictive client networks may need one.

Only enable this profile when using self-hosted LiveKit. Our hosted deployment uses Cloudflare instead.

## Product settings

`BILLING_ENABLED=false` gives everyone unlimited sessions and hides payment UI. Leave Polar credentials empty when billing is disabled. To charge users, configure production Polar products, benefit and webhook as described in [DEPLOY.md](DEPLOY.md#polar-setup).

`MARKETING_ENABLED=false` turns off landing and SEO pages; `/` goes to sign-in. `SIGNUPS_MODE=open` allows registration, `invite` requires an invitation, and `closed` disables new signups. Existing users can still sign in.

Set `APP_NAME`, `LOGO_URL` and `SUPPORT_EMAIL` for branding. `ADMIN_EMAILS` is a comma-separated list of administrator email addresses.

## Environment variables

This table covers every entry in `.env.example`. Defaults below are schema/template defaults, not production secrets. Blank optional values are omitted. `pnpm setup` replaces database and authentication placeholders with private generated values. Change the template's `NODE_ENV=development` to `production` in the production runtime file. Public `NEXT_PUBLIC_*` values are baked into the image; changing only runtime.env cannot change them.

| Name                          | Required?               | Default                           | Description                                                                               |
| ----------------------------- | ----------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| APP_URL                       | Production              | `http://localhost:3000`           | Public origin; HTTPS in production.                                                       |
| DATABASE_URL                  | Production and worker   | Local template URL                | PostgreSQL connection string; use `db:5432` in production.                                |
| BETTER_AUTH_SECRET            | Production              | Replaceable placeholder           | Random authentication secret, at least 32 characters; setup generates it.                 |
| GOOGLE_CLIENT_ID              | With Google login       | Empty                             | OAuth client ID.                                                                          |
| GOOGLE_CLIENT_SECRET          | With Google login       | Empty                             | OAuth secret; configure both Google values together.                                      |
| POLAR_ENVIRONMENT             | With billing            | `sandbox`                         | Use `production` for real payments.                                                       |
| POLAR_ACCESS_TOKEN            | With billing            | Empty                             | Private Polar API token.                                                                  |
| POLAR_WEBHOOK_SECRET          | With Polar token        | Empty                             | Webhook signature secret.                                                                 |
| POLAR_MONTHLY_PRODUCT_ID      | For monthly checkout    | Empty                             | Plus monthly product.                                                                     |
| POLAR_YEARLY_PRODUCT_ID       | For yearly checkout     | Empty                             | Plus yearly product.                                                                      |
| POLAR_LIFETIME_PRODUCT_ID     | Optional                | Empty                             | Optional lifetime product.                                                                |
| POLAR_PRO_BENEFIT_ID          | With Polar token        | Empty                             | Custom Plus benefit ID; variable retains the boilerplate name.                            |
| EMAIL_MODE                    | Production              | `preview`                         | `preview` stores mail in PostgreSQL; production requires `send`.                          |
| EMAIL_FROM                    | When sending            | `Starter <onboarding@resend.dev>` | Use your verified Resend sender in production.                                            |
| RESEND_API_KEY                | With `EMAIL_MODE=send`  | Empty                             | Resend API key; no SMTP transport is implemented.                                         |
| LOG_LEVEL                     | No                      | `info`                            | `debug`, `info`, `warn`, `error`, or `silent`.                                            |
| SENTRY_DSN                    | Optional                | Empty                             | Server error reporting DSN.                                                               |
| SENTRY_RELEASE                | Optional                | Empty                             | Server release identifier.                                                                |
| POSTHOG_KEY                   | With analytics          | Empty                             | PostHog project key, read at runtime (the old `NEXT_PUBLIC_POSTHOG_KEY` name also works). |
| POSTHOG_HOST                  | With analytics          | `https://us.i.posthog.com`        | PostHog ingestion host, read at runtime; events go through `/ingest` on your domain.      |
| NEXT_PUBLIC_SENTRY_DSN        | Optional                | Empty                             | Browser error reporting DSN; build time.                                                  |
| NEXT_PUBLIC_SENTRY_RELEASE    | Optional                | Empty                             | Browser release identifier; build time.                                                   |
| SENTRY_AUTH_TOKEN             | For source-map uploads  | Empty                             | Build-only secret; never pass as Docker ARG. Current workflow does not upload maps.       |
| SENTRY_ORG                    | For source-map uploads  | Empty                             | Sentry organization slug.                                                                 |
| SENTRY_PROJECT                | For source-map uploads  | Empty                             | Sentry project slug.                                                                      |
| TEST_DATABASE_URL             | Tests only              | Local `_test` URL                 | Isolated test database; name must end in `_test`. Leave empty in production.              |
| NODE_ENV                      | Production              | `development`                     | Docker sets production unless overridden; production env files must use `production`.     |
| APP_NAME                      | No                      | `FocusKept`                       | Display name.                                                                             |
| LOGO_URL                      | Optional                | Empty                             | Branding logo URL.                                                                        |
| SUPPORT_EMAIL                 | Optional                | Empty                             | Support contact.                                                                          |
| BILLING_ENABLED               | No                      | `false`                           | Enable Polar plans; false gives everyone unlimited sessions.                              |
| ANALYTICS_ENABLED             | No                      | `false`                           | Enable configured analytics; consent still applies.                                       |
| MARKETING_ENABLED             | No                      | `true`                            | Enable landing and SEO pages.                                                             |
| SIGNUPS_MODE                  | No                      | `open`                            | `open`, `invite`, or `closed`.                                                            |
| ADMIN_EMAILS                  | Optional                | Empty                             | Comma-separated administrator emails.                                                     |
| FREE_WEEKLY_SESSIONS          | No                      | `3`                               | Free plan weekly session allowance.                                                       |
| HOST_PERK_SESSIONS            | No                      | `8`                               | Host perk session threshold.                                                              |
| HOST_MIN_SESSIONS             | No                      | `10`                              | Host programme minimum sessions.                                                          |
| VIDEO_PROVIDER                | Production              | `none`                            | `cloudflare`, `livekit`, or local-only `none`.                                            |
| CLOUDFLARE_REALTIME_APP_ID    | Cloudflare video        | Empty                             | Realtime SFU app ID.                                                                      |
| CLOUDFLARE_REALTIME_APP_TOKEN | Cloudflare video        | Empty                             | Realtime app API token; private.                                                          |
| CLOUDFLARE_TURN_KEY_ID        | Cloudflare TURN         | Empty                             | TURN key ID.                                                                              |
| CLOUDFLARE_TURN_KEY_TOKEN     | Cloudflare TURN         | Empty                             | TURN key API token; private.                                                              |
| CLOUDFLARE_ACCOUNT_ID         | Cloudflare usage checks | Empty                             | Account to monitor.                                                                       |
| CLOUDFLARE_ANALYTICS_TOKEN    | Cloudflare usage checks | Empty                             | Account Analytics read API token.                                                         |
| VIDEO_USAGE_ALERT_GB          | No                      | `800`                             | Monthly video usage alert threshold in GB.                                                |
| LIVEKIT_URL                   | LiveKit video           | Empty                             | Public LiveKit URL, `wss://livekit.<domain>` in production.                               |
| LIVEKIT_API_KEY               | LiveKit video           | Empty                             | API key matching the server configuration.                                                |
| LIVEKIT_API_SECRET            | LiveKit video           | Empty                             | Signing secret matching the server configuration.                                         |
| VAPID_PUBLIC_KEY              | Web push                | Empty                             | Public push key; generate using `npx web-push generate-vapid-keys`.                       |
| VAPID_PRIVATE_KEY             | Web push                | Empty                             | Private push key; configure both VAPID values together.                                   |

Setup also generates Compose identity variables outside this template: `COMPOSE_PROJECT_NAME`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, local `APP_PORT`/`DB_PORT`/`TEST_DB_PORT`, and production `APP_PROXY_ALIAS`, `APP_ENV_FILE`, `IMAGE_REPOSITORY`. Production commands require `APP_IMAGE` as an immutable digest. `BACKUP_DIR` optionally overrides the backup location.

## Updating and backups

Publish a verified image for your server architecture, copy any changed deployment files deliberately, and export its immutable digest as `APP_IMAGE`. Pull `app worker`, take a backup, review and explicitly run any migrations, then run `bash deploy.sh "$APP_IMAGE"`. The complete commands are in [DEPLOY.md](DEPLOY.md). Both processes update and roll back together; rollback does not revert database changes.

The worker joins the internal `private` network for the database and an `egress` network for outgoing calls (email, push, Polar, Cloudflare). It publishes no ports.

Schedule `deploy/backup.sh` daily from the deployed directory. It retains 14 daily and 8 Sunday custom-format PostgreSQL dumps, with mode 600. Keep encrypted off-server copies and test `pg_restore --clean --if-exists --exit-on-error` on an isolated database. [DEPLOY.md](DEPLOY.md#backups-and-monitoring) includes cron and restore examples.

Monitor `/api/health` for web/database uptime and its `worker` field separately. A heartbeat older than three minutes is `stale`; missing or unreadable heartbeat is `unknown`. Worker status does not make a healthy web endpoint fail. Follow both logs with `docker compose --env-file .env -f compose.production.yaml logs -f app worker`, with `APP_IMAGE` exported from `.validated-image`.
