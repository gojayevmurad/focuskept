#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
image="${1:?Pass an immutable GHCR digest, a local/<name>:<git sha> image or --rollback}"
# Registry images are pinned by digest. Images built on this host and loaded with
# `docker load` live under local/ and are tagged with the git commit they came from.
remote_image() { [[ "$1" =~ ^ghcr\.io/[a-z0-9_./-]+@sha256:[a-f0-9]{64}$ ]]; }
local_image() { [[ "$1" =~ ^local/[a-z0-9_-]+:[a-f0-9]{7,40}$ ]]; }
valid_image() { remote_image "$1" || local_image "$1"; }
repository_of() { if remote_image "$1"; then printf '%s' "${1%@sha256:*}"; else printf '%s' "${1%:*}"; fi; }
# Reject arbitrary input before touching deployment state.
if [[ "$image" != --rollback ]] && ! valid_image "$image"; then echo "Invalid image digest" >&2; exit 1; fi
exec 9>.deploy.lock
flock -n 9 || { echo "Deployment already running" >&2; exit 1; }
if [[ "$image" == --rollback ]]; then image="$(cat .previous-image)"; fi
valid_image "$image" || { echo "Invalid image digest" >&2; exit 1; }
[[ -f .env ]] || { echo "Provision this project first (.env missing)" >&2; exit 1; }
# Generated .env contains no executable shell. Never source it.
repository="$(sed -n 's/^IMAGE_REPOSITORY=//p' .env)"
project="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' .env)"
[[ "$repository" =~ ^(ghcr\.io/[a-z0-9_./-]+|local/[a-z0-9_-]+)$ && "$project" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "Invalid project identity in .env" >&2; exit 1; }
[[ "$(repository_of "$image")" == "$repository" ]] || { echo "Image belongs to another project" >&2; exit 1; }
previous=""
if [[ -f .validated-image ]]; then
 previous="$(cat .validated-image)"
 valid_image "$previous" && [[ "${previous%@sha256:*}" == "$repository" ]] || { echo "Invalid saved image" >&2; exit 1; }
fi
# Compose identity and credentials come from this project's file, not shared shell exports.
unset COMPOSE_PROJECT_NAME POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD APP_ENV_FILE APP_PROXY_ALIAS IMAGE_REPOSITORY
export APP_IMAGE="$image"
compose=(docker compose --project-name "$project" --env-file .env -f compose.production.yaml)
"${compose[@]}" config --quiet
if remote_image "$image"; then
 "${compose[@]}" pull app worker
else
 docker image inspect "$image" >/dev/null || { echo "Load the image on this host first" >&2; exit 1; }
fi
healthy=false
if "${compose[@]}" up -d --no-deps --wait --wait-timeout 120 app worker; then
 if "${compose[@]}" exec -T app node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then healthy=true; fi
fi
if [[ "$healthy" != true ]]; then
 echo "Health verification failed" >&2
 if [[ -n "$previous" ]]; then
  export APP_IMAGE="$previous"
  "${compose[@]}" up -d --no-deps --wait --wait-timeout 120 app worker
  echo "Previous validated image restored" >&2
 else
  echo "First deployment failed; no previous validated image exists" >&2
 fi
 exit 1
fi
# Re-deploying the same digest must not erase the rollback target.
if [[ -n "$previous" && "$previous" != "$image" ]]; then
 printf '%s\n' "$previous" > .previous-image.tmp
 mv .previous-image.tmp .previous-image
fi
printf '%s\n' "$image" > .validated-image.tmp
mv .validated-image.tmp .validated-image
echo "Deployment verified"
