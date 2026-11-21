#!/usr/bin/env bash
# Run from the deployed directory (requires Docker Compose and util-linux flock):
# 15 3 * * * cd /srv/saas/focuskept/deploy && bash backup.sh >> backup.log 2>&1
# Restore drill: use an isolated database, with app and worker stopped if restoring production.
# export APP_IMAGE="$(cat .validated-image)"
# docker compose --env-file .env -f compose.production.yaml exec -T db \
#   pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --exit-on-error < backup.dump
set -euo pipefail
cd "$(dirname "$0")"
umask 077
exec 9>.backup.lock
flock -n 9 || { echo "Backup already running" >&2; exit 1; }
# Read generated values as data, never source an env file.
project="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' .env)"
POSTGRES_USER="$(sed -n 's/^POSTGRES_USER=//p' .env)"
POSTGRES_DB="$(sed -n 's/^POSTGRES_DB=//p' .env)"
[[ "$project" =~ ^[a-z][a-z0-9-]*$ && -n "$POSTGRES_USER" && -n "$POSTGRES_DB" ]] || { echo "Invalid backup project configuration" >&2; exit 1; }
backup_dir="${BACKUP_DIR:-/srv/backups/$project}"
mkdir -p "$backup_dir/daily" "$backup_dir/weekly"
chmod 700 "$backup_dir" "$backup_dir/daily" "$backup_dir/weekly"
unset COMPOSE_PROJECT_NAME POSTGRES_PASSWORD APP_ENV_FILE APP_PROXY_ALIAS IMAGE_REPOSITORY
export APP_IMAGE="${APP_IMAGE:-$(cat .validated-image)}"
# One UTC instant determines the filename, day and Sunday classification.
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
day="${stamp:0:10}"
temporary="$(mktemp "$backup_dir/.dump.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
docker compose --project-name "$project" --env-file .env -f compose.production.yaml \
  exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$temporary"
[[ -s "$temporary" ]] || { echo "Empty database backup" >&2; exit 1; }
chmod 600 "$temporary"
# Replace today's daily only after a complete dump; keep one copy per UTC day.
shopt -s nullglob
mv -- "$temporary" "$backup_dir/daily/$stamp.dump"
for old in "$backup_dir/daily/$day"T*.dump; do
  if [[ "$old" != "$backup_dir/daily/$stamp.dump" ]]; then rm -- "$old"; fi
done
if [[ "$(date -u -d "$day" +%u)" == 7 ]]; then
  temporary="$(mktemp "$backup_dir/.weekly.XXXXXX")"
  cp -- "$backup_dir/daily/$stamp.dump" "$temporary"
  chmod 600 "$temporary"
  mv -- "$temporary" "$backup_dir/weekly/$stamp.dump"
  for old in "$backup_dir/weekly/$day"T*.dump; do
    if [[ "$old" != "$backup_dir/weekly/$stamp.dump" ]]; then rm -- "$old"; fi
  done
fi
# ISO UTC filenames sort chronologically. Keep 14 distinct days and 8 Sundays.
prune() {
  local directory="$1" keep="$2" i
  local files=("$directory/"????-??-??T??????Z.dump)
  for ((i=0; i<${#files[@]}-keep; i++)); do rm -- "${files[i]}"; done
}
prune "$backup_dir/daily" 14
prune "$backup_dir/weekly" 8
echo "Backup complete: $backup_dir/daily/$stamp.dump"
