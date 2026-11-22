#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Points one site block in a shared Caddyfile at a new upstream and reloads
# Caddy without a restart. Keeps a backup and restores it if validation fails.
#
#   bash point-domain.sh <domain> <upstream-alias> [caddy-dir]
#   bash point-domain.sh staging.example.com myapp-app /srv/infra/caddy
set -euo pipefail
domain="${1:?Pass the domain, e.g. example.com}"
upstream="${2:?Pass the upstream alias, e.g. myapp-app}"
dir="${3:-/srv/infra/caddy}"
file="$dir/Caddyfile"
[[ "$domain" =~ ^[a-z0-9.-]+$ && "$upstream" =~ ^[a-z0-9-]+$ ]] || { echo "Invalid domain or upstream" >&2; exit 1; }
grep -q "^${domain//./\\.} {" "$file" || { echo "No site block for $domain in $file" >&2; exit 1; }

backup="$file.$(date -u +%Y%m%dT%H%M%SZ).bak"
cp -p "$file" "$backup"
# Rewrite only the reverse_proxy line inside this domain's block. Writing into
# the same file (not replacing it) keeps the bind mount pointing at it.
next="$(awk -v d="$domain {" -v u="$upstream" '
  $0 == d { inside = 1 }
  inside && /reverse_proxy / { sub(/reverse_proxy [^ {]+/, "reverse_proxy " u ":3000") }
  inside && /^}/ { inside = 0 }
  { print }
' "$file")"
printf '%s\n' "$next" > "$file"
diff -u "$backup" "$file" || true

cd "$dir"
if docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 &&
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "$domain now goes to $upstream (backup: $backup)"
else
  cat "$backup" > "$file"
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
  echo "Validation or reload failed; restored $backup" >&2
  exit 1
fi
