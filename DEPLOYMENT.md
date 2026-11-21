# Deployment contract

Start with [START_NEW_SAAS.md](START_NEW_SAAS.md) for the Azerbaijani step-by-step guide. `pnpm setup` generates project identity and separate local/production configuration. Provisioning is explicit and one-time per project; routine releases reuse those files.

## Per-project files on the VPS

```
/srv/saas/<slug>/deploy/
  compose.production.yaml
  deploy.sh
  .env                    # Compose identity, DB credentials, expected GHCR repository
  runtime.env             # Application secrets; .env references this absolute path
  .validated-image        # Last health-verified digest
  .previous-image         # Rollback target
```

Generated secrets live in ignored `deploy/generated/` locally and are excluded from Docker build context. Copy them securely once, restrict directory/file modes to 700/600, and keep encrypted backups. Re-running setup preserves env files and never rotates credentials. Partial production secret bundles are rejected. Do not reuse a slug across SaaS instances on one server. Never alter a running database's env password without an explicit database credential rotation.

Compose names all networks/volumes per project. PostgreSQL only joins the internal private network, has no production host port, and uses a dedicated persistent volume. Only the app joins central external `proxy`, with a unique alias. The proxy network must allow outbound DNS/HTTPS for Polar, Resend, optional Google OAuth, PostHog and Sentry. Treat all containers on that shared network as trusted peers. Separate Docker accounts/directories are operational isolation, not a security boundary against Docker administrators.

## Release pipeline and authorization

Quality runs on PRs and main pushes with a frozen lockfile, typecheck, lint, unit/integration tests, production build and browser tests. The test service is an isolated PostgreSQL database. Production reacts only to same-repository main push Quality success, or authorized manual dispatch on main. It verifies the latest Quality result and a merged PR association for the exact current main SHA in both modes. No PR artifact is downloaded or executed with deployment credentials.

The SHA is checked out explicitly and built for linux/arm64. GHCR gets a commit tag, but deployments always use the returned immutable digest. `provision_only=true` publishes that checked image without SSH deployment, solving first-server setup without introducing a separate release platform.

Set repository variables `DEPLOY_MODE`, `DEPLOY_PATH`; manual mode also requires comma-separated `DEPLOY_ACTORS`. Set DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY and DEPLOY_KNOWN_HOSTS as secrets:

- `protected`: use a `production` environment. The workflow verifies an actual required-reviewer rule and a merged PR association before publishing. The deploy job then waits for native GitHub approval. Keep production credentials in environment secrets, configure main-only deployment branches and prevent bypass as your plan allows.
- `manual` (default): no environment is referenced by the SSH job, so private repositories without environment support can use it. Only an allowlisted write-access operator can dispatch a deployment. Keep credentials in repository secrets. No automatic deployment takes place. This is explicit operator authorization, not an independent second-person approval system.

GitHub plan and repository visibility determine available protections; the mere presence of `environment: production` does not prove a reviewer gate exists. Public repositories support more rules on Free/Pro/Team; private environment access requires Pro/Team/Enterprise, while private required-reviewer rules generally require Enterprise. Verify actual repository Settings and [GitHub's current documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments). Do not silently downgrade protected mode. Use branch protections/rulesets for approved PR merges wherever the plan supports them; repository administrators remain trusted and can change workflows/secrets. A solo owner cannot approve their own PR through GitHub's review feature.

Both deploy paths use the same composite SSH action. It pins host keys, validates the project path, cleans temporary key files, and rechecks main immediately before SSH so a release waiting for approval cannot overwrite a newer main unnoticed. GitHub/VPS network execution still requires real verification.

## Routine deployment safety

`deploy.sh` locks the project, validates the digest against `IMAGE_REPOSITORY`, pins the Compose project from its local file, and discards conflicting inherited Compose credential variables. It pulls and recreates **only app**, with `--no-deps`; it never starts/recreates PostgreSQL during routine deploy. Docker must already have the project database running from provisioning. Container health and an additional app-to-DB health request must pass before the validated digest is atomically recorded.

On startup/health failure it attempts restoration of the previous verified image and reports failure. `bash deploy.sh --rollback` selects the saved prior digest under the same lock. Repeating an identical digest does not overwrite the rollback target. A pull failure leaves the running app untouched. First-deploy failure has no rollback target. Zero downtime is not promised.

No deployment step runs migrations, `down`, volume deletion or database reset. After SQL review and backup, an operator explicitly runs the shipped `scripts/migrate.cjs` using `compose run --rm --no-deps app`. Prefer additive, backward-compatible migrations. App rollback does not revert schema or data; rehearse off-server backup restoration separately.

## Caddy, secrets and operations

The existing centralized Caddy architecture stays intact. Setup writes an example only; a proxy owner must approve its one-time addition. No workflow edits Caddy or public DNS. Validate HTTPS and the public `/api/health` after first routing and after operational changes. Routine deployment health checks are internal, so public TLS/proxy health is a separate operator check.

Production runtime is non-root, with ARM64-compatible multi-stage images, rotating logs, resource limits, signal forwarding and a 30-second termination grace period. `NEXT_PUBLIC_*` values are public build arguments. Private runtime env files are never copied into images. Sentry source-map uploads remain disabled without securely supplied build credentials; use BuildKit secrets rather than ARG if enabling them.

Provision Docker/Compose, central proxy, backups and SSH once per VPS; provision a directory, credentials, database/volume, GHCR pull access and domain route once per SaaS. The deploy account's Docker access is effectively host-privileged. Restrict accounts and SSH keys as practical. Obtain known host keys out of band. Avoid printing `docker compose config` or env files because they contain credentials; use `config --quiet` for validation. Routine releases never overwrite server secret files or synchronize infrastructure files implicitly.
