# Start 7by11.com

This folder is the complete application source for the implemented pilot. No separate Northstar folder or frontend build is required. The website is not publicly hosted and the future domain is not required to run it.

## 1. Extract and open the application folder

Extract the ZIP completely. Open a terminal inside `sevenbyeleven` — the folder containing this file, `README.md`, `Dockerfile`, and `compose.yaml`.

Do not run Docker and Python-only modes together: both use port 3000.

## 2. Choose one way to run

### Docker with PostgreSQL — recommended

Requirements: Docker Engine with Compose v2, or Docker Desktop; Python 3.12; internet for the first image and dependency downloads. Start Docker before running commands. On Windows, use Docker Desktop with Linux containers.

Linux, macOS, or Ubuntu in WSL2:

```bash
bash scripts/start.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

The scripts preserve an existing `.env`, otherwise create one with a random database password. They validate Compose, start PostgreSQL and the app, wait for readiness, and perform a read-only smoke check. A failed command stops the script. Do not share `.env`.

### Python-only local demo with SQLite

Requirements: Python 3.12, its venv module, and internet on first setup. Docker and Node are not required.

Linux/macOS/WSL:

```bash
python3 scripts/run-local.py
```

Windows:

```powershell
python scripts/run-local.py
```

The launcher creates `.venv` and installs requirements when missing. It explicitly uses the local SQLite database, ignores Compose `.env` settings, and binds to localhost. Stop with Ctrl+C. On Ubuntu, if venv creation fails, install the venv package matching your Python version. This mode is for local development, not public hosting.

## 3. Open the website

Open **http://localhost:3000** in your browser. Use **Sign in** to select a role. Customers land in shopping; staff land in their workspace. The **Workspace** navigation returns to staff tools. No role has a separate deployment or URL.

| Role | Demo email | Interface |
|---|---|---|
| Customer | customer@example.com | Storefront, bag, checkout, orders, account, saved products, help |
| Seller | seller@example.com | Products, price/stock, store orders, returns, earnings, staff |
| Second seller | seller2@example.com | Same seller tools scoped to another store |
| Admin | admin@example.com | Store/product moderation, delivery assignment, users, coupons, audit |
| Delivery | delivery@example.com | Assigned deliveries and delivery-code verification |
| Warehouse | warehouse@example.com | Packing and return receipt |
| Support | support@example.com | Ticket replies and status |
| Finance | finance@example.com | Simulated payout approvals |

All demo passwords: `7by11Demo!2026`. Private testing only. Orders and operational queues are empty until you create an order and progress it using the relevant roles. The role previews previously shown use separate sample orders; that fixture is not shipped as your application database. Reloading signs you out; sign in again.

## 4. Stop and restart

Docker, from this folder:

```bash
docker compose stop
docker compose up -d --wait
```

Data is retained in the PostgreSQL volume. **Do not run `docker compose down -v` unless you intend to erase the database.** In Python mode, run the same launcher again; local data is retained in `data/7by11.db`.

## 5. Troubleshooting

- Docker unavailable: start Docker Desktop or Docker Engine; confirm `docker info` works.
- Port 3000 occupied: stop the other app, including the original Northstar stack or a previous Python demo.
- Slow first build: inspect `docker compose logs --tail=100` and `docker compose ps`; rerun the startup script after resolving the issue.
- Docker daemon permission denied: use your platform's documented Docker setup; do not change application files to bypass host permissions.
- Blank or stale page: confirm `/ready` responds at http://localhost:3000/ready, reload, and sign in again.
- Database authentication after editing a password: existing volumes retain their original credentials. Restore the matching `.env` or follow the guide to rotate credentials; changing `.env` alone does not rotate PostgreSQL users.

## 6. Deployment and feature boundaries

Read `README.md` and `docs/GUIDE.md` for cloud VM setup, backups, domain activation and operations. The editable guide is included at `docs/7by11_Complete_Deployment_Guide.docx`. This start file adds the convenient launchers; the guide's manual commands remain valid.

Future domain settings are commented in `.env.example` and `deploy/Caddyfile`. Purchase the domain, configure DNS and network access, then follow the documented activation sequence. All local functions operate without that domain.

Payment, COD accounting, refunds and payouts are simulations. Live payment gateways, couriers, tax invoices and larger Amazon/Flipkart additions are not included. Consult `docs/FEATURES.md` for exact implemented and remaining scope, and `docs/VERIFICATION.md` for checks performed and checks still required on your machine. No cloud account, Kubernetes cluster or external service is needed for the included Compose application.
