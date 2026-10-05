#!/usr/bin/env bash
set -euo pipefail
backup_path="${1:?Usage: bash scripts/restore.sh backups/file.dump}"
test -s "$backup_path"
printf 'This replaces the marketplace database. Type RESTORE to continue: '
read -r answer
[ "$answer" = RESTORE ] || exit 1
docker compose stop app
cat "$backup_path" | docker compose exec -T postgres pg_restore -U sevenbyeleven -d sevenbyeleven --clean --if-exists --no-owner --exit-on-error
docker compose start app
