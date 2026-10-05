$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Install Python 3.12 and add it to PATH.' }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install Docker Desktop first.' }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop, then retry.' }
python scripts/init-env.py
if ($LASTEXITCODE -ne 0) { throw 'Environment initialization failed.' }
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose configuration failed.' }
docker compose up --build -d --wait --wait-timeout 300
if ($LASTEXITCODE -ne 0) { throw 'Startup failed. Run docker compose logs --tail=100.' }
python scripts/smoke.py
if ($LASTEXITCODE -ne 0) { throw 'Smoke check failed. Run docker compose ps and docker compose logs --tail=100.' }
Write-Host 'Open http://localhost:3000. Stop with: docker compose stop'
