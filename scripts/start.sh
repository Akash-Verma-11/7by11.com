#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v python3 >/dev/null || { printf 'Install Python 3.12 first.\n'; exit 1; }
command -v docker >/dev/null || { printf 'Install Docker Engine and the Compose plugin, or Docker Desktop.\n'; exit 1; }
docker info >/dev/null 2>&1 || { printf 'Start Docker, then rerun this command.\n'; exit 1; }
python3 scripts/init-env.py
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 300
python3 scripts/smoke.py
printf 'Open http://localhost:3000\nStop with: docker compose stop\n'
