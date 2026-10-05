#!/usr/bin/env bash
set -euo pipefail
mkdir -p backups
backup_path="backups/sevenbyeleven-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T postgres pg_dump -U sevenbyeleven -d sevenbyeleven -Fc > "$backup_path"
test -s "$backup_path"
printf 'Backup created: %s\n' "$backup_path"
