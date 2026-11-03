#!/usr/bin/env bash
# Forced command for the CI deploy key (authorized_keys `command=`): that key
# can only deploy one GHCR digest to staging or production. CI runs
# `ssh host "<target> <image-digest>"` and sends its short-lived GITHUB_TOKEN on
# stdin for the private registry pull.
set -euo pipefail
read -r target image extra <<< "${SSH_ORIGINAL_COMMAND:-}"
case "$target" in
 staging) dir=/srv/apps/focuskept-staging/deploy ;;
 production) dir=/srv/apps/focuskept/deploy ;;
 *) echo "Expected: staging|production <image-digest>" >&2; exit 1 ;;
esac
[[ -z "${extra:-}" && "$image" =~ ^ghcr\.io/[a-z0-9_./-]+@sha256:[a-f0-9]{64}$ ]] || { echo "Expected an image digest" >&2; exit 1; }
token="$(cat)"
# A throwaway Docker config keeps the token out of ~/.docker for good.
DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
if [[ -n "$token" ]]; then
 printf '%s' "$token" | docker login ghcr.io -u github-actions --password-stdin >/dev/null
fi
bash "$dir/deploy.sh" "$image"
