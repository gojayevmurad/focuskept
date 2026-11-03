#!/usr/bin/env bash
# Nightly PostgreSQL backups for every FocusKept environment on this server.
# Keeps 7 local copies and 30 days in Cloudflare R2 (bucket focuskept-backups).
# Cron (deploy user): 30 3 * * * /srv/apps/focuskept/backup/backup.sh
# Restore: docker exec -i <db-container> pg_restore -U <user> -d <db> --clean < file.dump
set -euo pipefail
umask 077
here="$(cd "$(dirname "$0")" && pwd)"
local_dir=/srv/apps/focuskept/backups
rclone=(docker run --rm --env-file "$here/r2.env" -v "$local_dir:/backups:ro" rclone/rclone:1.69.1)
stamp="$(date -u +%Y%m%d-%H%M)"
status=0

for env_dir in /srv/apps/focuskept-staging/deploy /srv/apps/focuskept/deploy; do
  [[ -f "$env_dir/.env" ]] || continue
  project="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$env_dir/.env")"
  db_user="$(sed -n 's/^POSTGRES_USER=//p' "$env_dir/.env")"
  db_name="$(sed -n 's/^POSTGRES_DB=//p' "$env_dir/.env")"
  container="$project-db-1"
  # An environment whose database isn't running (e.g. production before launch) is skipped.
  docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null | grep -qx true || continue
  mkdir -p "$local_dir/$project"
  file="$local_dir/$project/$project-$stamp.dump"
  if docker exec "$container" pg_dump -U "$db_user" -d "$db_name" -Fc > "$file.tmp" &&
    [[ -s "$file.tmp" ]]; then
    mv "$file.tmp" "$file"
    echo "$(date -u +%FT%TZ) $project: $(du -h "$file" | cut -f1) dumped"
  else
    rm -f "$file.tmp"
    echo "$(date -u +%FT%TZ) $project: dump FAILED" >&2
    status=1
    continue
  fi
  # Keep the newest 7 locally.
  ls -1t "$local_dir/$project"/*.dump | tail -n +8 | xargs -r rm -f
  if "${rclone[@]}" copy "/backups/$project/$(basename "$file")" "r2:focuskept-backups/$project/" --quiet; then
    echo "$(date -u +%FT%TZ) $project: uploaded to R2"
  else
    echo "$(date -u +%FT%TZ) $project: upload FAILED" >&2
    status=1
  fi
  "${rclone[@]}" delete "r2:focuskept-backups/$project/" --min-age 30d --quiet || true
done
exit "$status"
