# Production deployment

This guide targets our Ubuntu ARM64 VPS. Web and worker use one immutable image. Video uses Cloudflare; no TURN server or video UDP ports are needed on this VPS.

## 1. Prerequisites

Install Docker Engine with the Compose plugin, Bash and util-linux (`flock`). Keep the existing central Caddy on the external Docker network `proxy`. Check it with `docker network inspect proxy`. Point the domain's Cloudflare DNS records at the VPS. Allow web HTTPS and restricted SSH access.

Locally use Node 24 and pnpm 11. Run `pnpm install --frozen-lockfile`, then `pnpm setup`. Setup creates `.env.local` and the private production bundle in `deploy/generated/`: `.env`, `runtime.env`, and `Caddyfile.example`. Setup preserves existing credentials; it does not rotate secrets. Never reuse a project slug or change a running database's password by editing its env file.

## 2. Copy the deployment files

Create `/srv/saas/<slug>/deploy` on the VPS, owned by the deploy account, with mode 700. Copy these files securely:

- `deploy/compose.production.yaml`, `deploy/deploy.sh`, `deploy/backup.sh`.
- `deploy/generated/.env` and `deploy/generated/runtime.env` as `.env` and `runtime.env` in that directory.
- `deploy/generated/Caddyfile.example` for the central proxy owner to review.

Run in the server directory:

```sh
chmod 700 . deploy.sh backup.sh
chmod 600 .env runtime.env
```

Keep encrypted copies of both env files. Confirm `APP_ENV_FILE` in `.env` is the absolute server path to `runtime.env`. Do not print expanded Compose configuration; it contains secrets. Use `config --quiet`.

## 3. Configure runtime.env

Set `NODE_ENV=production`, `APP_URL=https://<domain>`, and `APP_NAME`. Keep the generated database URL and authentication secret. Set:

- Resend: `EMAIL_MODE=send`, `RESEND_API_KEY`, and `EMAIL_FROM` on a verified sending domain. Send mode requires Resend; there is no generic SMTP transport.
- Polar: production credentials and product/benefit IDs as described below. Use `POLAR_ENVIRONMENT=production`; enable billing after completing setup.
- Cloudflare: `VIDEO_PROVIDER=cloudflare`, the Realtime app ID/token, TURN key ID/token, account ID and analytics token.
- Google OAuth, if used: both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register `https://<domain>/api/auth/callback/google` as the callback.
- Web push: generate keys with `npx web-push generate-vapid-keys`; set both VAPID values.
- PostHog: set `ANALYTICS_ENABLED=true` only when configured. The public PostHog key/host and public Sentry DSN/release are build-time values; configure repository variables before publishing the image.
- Sentry: recommended for production. Set `SENTRY_DSN` and `SENTRY_RELEASE`; source-map uploads need separately secured build credentials and are not enabled by this workflow.

See [SELF_HOSTING.md](SELF_HOSTING.md) for all variables. The worker joins the internal `private` network for the database and an `egress` network for outgoing calls (email, push, Polar, Cloudflare). It publishes no ports.

## Polar setup

In Polar's production environment, create Plus monthly and yearly subscription products with a 7 day trial. Create a custom benefit named `Plus` and attach it to both products. Set `POLAR_MONTHLY_PRODUCT_ID`, `POLAR_YEARLY_PRODUCT_ID` and `POLAR_PRO_BENEFIT_ID` (the code retains this variable name for the Plus benefit). The lifetime product is optional.

Create a webhook at `https://<domain>/api/webhooks/polar` with these events:

- `customer.state_changed`
- `order.paid`
- `subscription.active`
- `subscription.canceled`
- `subscription.updated`
- `subscription.revoked`

Copy the access token and webhook secret into `runtime.env`, set `POLAR_ENVIRONMENT=production`, then `BILLING_ENABLED=true`.

## Cloudflare Realtime setup

In the Cloudflare dashboard, create a Realtime SFU app and a TURN key. Copy their IDs and tokens into `CLOUDFLARE_REALTIME_APP_ID`, `CLOUDFLARE_REALTIME_APP_TOKEN`, `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_KEY_TOKEN`. Set `CLOUDFLARE_ACCOUNT_ID`. Create an API token with Account Analytics read permission for that account and put it in `CLOUDFLARE_ANALYTICS_TOKEN`. The worker uses this for usage monitoring; `VIDEO_USAGE_ALERT_GB` defaults to 800. Video traffic goes directly to Cloudflare.

## 4. Publish the first image

Configure repository variables `DEPLOY_PATH=/srv/saas/<slug>/deploy` and `DEPLOY_MODE`:

- `manual` (default): set comma-separated `DEPLOY_ACTORS`. An allowlisted operator dispatches releases; automatic SSH deployment is disabled.
- `protected`: configure an actual required-reviewer rule on the `production` environment and main-only deployment branches. Keep credentials in environment secrets. Do not downgrade this gate when the repository plan cannot support it.

Configure `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS` as secrets in the appropriate scope. Verify SSH host keys out of band. Docker access grants effective host administration rights.

Merge through a PR and let Quality pass on the exact current main commit. In Actions → Production, select main and run with `provision_only=true`. This publishes a checked linux/arm64 image without SSH deployment. Copy the complete `ghcr.io/<owner>/<repo>@sha256:<64 hex characters>` reference from the job summary.

On the VPS, log in to GHCR using a pull-only token with `read:packages` and access to this package:

```sh
read -rs -p 'GHCR pull token: ' GHCR_TOKEN; echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
unset GHCR_TOKEN
```

Do not use the publishing token on the VPS.

## 5. Provision the database and deploy

In `/srv/saas/<slug>/deploy`, use the verified image reference:

```sh
export APP_IMAGE='ghcr.io/<owner>/<repo>@sha256:<digest>'
docker compose --env-file .env -f compose.production.yaml config --quiet
docker compose --env-file .env -f compose.production.yaml up -d --wait db
docker compose --env-file .env -f compose.production.yaml pull app worker
docker compose --env-file .env -f compose.production.yaml run --rm --no-deps app node scripts/migrate.cjs
bash deploy.sh "$APP_IMAGE"
```

Migrations are explicit. Review SQL first; on later releases take a backup before applying them. Prefer additive changes compatible with both images. `deploy.sh` never runs migrations, recreates PostgreSQL, deletes volumes, or resets data.

## 6. Add the Caddy route

Have the central proxy owner add the generated site block once, using the actual unique `APP_PROXY_ALIAS` from `.env`:

```caddyfile
<domain> {
    reverse_proxy <slug>-app:3000
}
```

Validate and reload the central Caddy configuration. Caddy automatically flushes `text/event-stream` responses for SSE. With Cloudflare proxying, keep Rocket Loader off and do not buffer or cache realtime API responses. Confirm HTTPS and `curl --fail https://<domain>/api/health`.

The database has no host port. Only web joins `proxy` by default; shared proxy containers are trusted peers. Do not start the optional LiveKit profile on our Cloudflare deployment.

## Routine releases and rollback

For schema changes, publish with `provision_only=true`, back up, and explicitly run migrations using the commands above with the new digest. Then run `bash deploy.sh "$APP_IMAGE"`. For releases without migrations, dispatch Production normally in manual mode or use the protected release path. Both SSH jobs call the same server `deploy.sh`; copy updated deployment scripts/Compose files deliberately when infrastructure changes. Secrets are never synchronized by the workflow.

The pipeline checks successful Quality and merged-PR association for the exact current main SHA, pins the image digest and verifies SSH host keys. The action rechecks main before SSH. The script locks the project, validates the image repository, ignores conflicting inherited Compose identity/credential values, and pulls both app and worker before recreating either. It recreates only those two services with `--no-deps`. Web health and a separate app-to-database request must pass before recording `.validated-image` atomically.

A failed startup or health check restores both services to the last validated image when one exists, and returns failure. A pull failure leaves running services untouched. First deployment has no rollback target. Repeating a digest preserves rollback history. Zero downtime is not promised. Worker heartbeat staleness does not block web deployment.

```sh
bash deploy.sh --rollback
export APP_IMAGE="$(cat .validated-image)"
docker compose --env-file .env -f compose.production.yaml logs -f app worker
```

Rollback changes both process images, not schema or data.

## Backups and monitoring

Run `bash backup.sh` once and verify it succeeds. Add this crontab entry (substitute the project slug):

```cron
15 3 * * * cd /srv/saas/focuskept/deploy && bash backup.sh >> backup.log 2>&1
```

The script uses UTC filenames and Sunday classification, stores custom-format dumps in `/srv/backups/<COMPOSE_PROJECT_NAME>` (override with `BACKUP_DIR`), and keeps 14 daily and 8 Sunday copies. Directories are mode 700 and dumps mode 600. Monitor cron failures and copy backups encrypted off-server.

Rehearse restoration into an isolated database regularly. Read the actual user/database names from `.env`; the following shell values must match the target database:

```sh
export APP_IMAGE="$(cat .validated-image)"
POSTGRES_USER='<database-user>'
POSTGRES_DB='<database-name>'
docker compose --env-file .env -f compose.production.yaml exec -T db pg_restore \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --exit-on-error < /path/to/backup.dump
```

For a production restore, stop app and worker first and restart them only after checking the restored database. Restoration replaces data; image rollback does not undo it.

Set an external uptime monitor on `https://<domain>/api/health`. Database/configuration failures return 503. The additional `worker` field is `ok`, `stale` after three minutes, or `unknown` without a usable heartbeat; it does not change HTTP 200. Monitor that field separately and check worker logs. Sentry is recommended alongside uptime checks.

## Deploying without a registry

On a single ARM64 server you can skip GHCR: build on a machine with the same architecture, copy the image over SSH and deploy it by commit.

```sh
sha=$(git rev-parse HEAD)
docker build --platform linux/arm64 -t local/<slug>:$sha .
docker save local/<slug>:$sha | gzip -1 | ssh <server> 'gunzip | docker load'
```

Set `IMAGE_REPOSITORY=local/<slug>` in the deployment `.env`, then on the server:

```sh
bash configure-runtime.sh https://<domain> local/<slug>:$sha [old-runtime.env]   # once, fills third-party keys
bash deploy.sh local/<slug>:$sha                                                   # health-checked, with rollback
bash point-domain.sh <domain> <slug>-app                                           # route the domain via the shared Caddy
```

`deploy.sh` only accepts `local/` images tagged with a commit hash, never mutable tags like `latest`.

## Search engines

FocusKept supports search discovery, AI answer engines (GEO), and instant crawling updates:

- **Google Search Console & Bing Webmaster Tools**:
  Set `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` in `runtime.env`. Meta verification tags are automatically rendered on public pages.
- **Sitemaps**:
  The XML sitemap is served at `https://<domain>/sitemap.xml` with hreflang alternates and lastmod timestamps for all public pages. Submit this URL in Google Search Console and Bing Webmaster Tools.
- **IndexNow (Bing, Yandex, Seznam)**:
  To instantly notify search engines of updated or published pages, generate an IndexNow key (e.g. an 8–128 character hex string) and set `INDEXNOW_KEY=<key>` in `runtime.env`.
  The verification key file is served at `https://<domain>/indexnow-key.txt`.
  After deploying updates, ping search engines with:
  ```sh
  node scripts/indexnow.mjs
  ```
- **AI Context (`llms.txt`)**:
  AI engines and assistants can read `https://<domain>/llms.txt` and `https://<domain>/llms-full.txt` for product facts, feature lists, pricing, and documentation.

