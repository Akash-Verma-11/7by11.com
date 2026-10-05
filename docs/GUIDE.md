# 7by11 Marketplace Deployment and Operating Guide

Prepared for Akash Verma. Release 1, 4 October 2026.

This guide takes you from the extracted source ZIP to a working private marketplace on your laptop or a Linux cloud VM. Follow the numbered deployment sections in order. Each checkpoint tells you what should work before you move on. The application is branded 7by11.com even while running at localhost. A purchased domain is not needed for development.

The app supports an end-to-end marketplace demonstration, including separate seller ownership and delivery/return workflows. Online payments, refunds and seller payouts are simulated. This release must not be used to take real customer money until the integration work in the feature coverage document is completed.

## 1 Choose your deployment path

The recommended path is Docker Compose with PostgreSQL. Use it first on your laptop, then repeat on a cloud VM. It keeps the application and database versions consistent and avoids installing PostgreSQL directly. Python with SQLite is an optional quick development path, described in README.md. Do not mix the two databases or expect their data to synchronize.

| Environment | Starting resources | Purpose |
|---|---|---|
| Laptop | Docker Desktop or Engine with Compose v2, Python 3, 4 GB available RAM, 10 GB free disk | Private development and walkthrough |
| Linux cloud VM | Suggested 2 vCPU, 4 GB RAM, 40 GB SSD, stable public IP, SSH access | Small private pilot; capacity estimate, not a load guarantee |
| Future domain | Purchased 7by11.com, DNS access, inbound TCP 80 and 443 | Optional public HTTPS endpoint |
| Commercial service | Managed backups, monitoring, tested database recovery, provider accounts and security review | Requires further integration and validation |

Examples use a Bash terminal on Linux, macOS or Ubuntu in WSL2. On Windows enable Docker Desktop integration for your WSL distribution. Execute project commands from the extracted sevenbyeleven folder, where compose.yaml is located. Replace example server IP and SSH user with your actual values; never paste the placeholders unchanged.

## 2 Understand the architecture

The browser receives HTML, CSS and JavaScript from the same Flask application that exposes the JSON API. Same-origin requests simplify local setup and avoid a separate frontend endpoint. Gunicorn runs Flask in the container. PostgreSQL persists users, stores, products, orders, stock movements, tickets and audit events. Docker named volumes keep database data across container restarts.

With no domain, your browser reaches localhost port 3000. On a remote VM, an SSH tunnel forwards your laptop's localhost port 3000 to the VM's loopback port 3000. The database has no published host port. With a future domain, Caddy receives HTTPS on 443 and forwards traffic to app:3000 on the private Compose network. Caddy manages certificate renewal when DNS and network prerequisites are satisfied.

The backend is a modular monolith: accounts.py handles identity and support, catalog.py handles stores and products, commerce.py handles cart/orders/returns, operations.py handles admin/delivery/finance, core.py handles authorization and shared rules, and db.py handles transactions. All use the same SQL schema. This deliberately reduces setup complexity; it is not a microservice deployment.

A checkout transaction validates the current cart, active listings, price quote, coupon and available stock; creates the order and seller lines; decrements stock; saves an idempotency key; and clears the cart. A failed transaction rolls back. Reusing the same checkout key and payload returns the same order, rather than taking stock twice. Prices are integer paise in the API and database; the UI converts them to rupees.

## 3 Inspect the extracted package

Keep the original Northstar ZIP as a reference. This release has a new schema and does not migrate original orders or users automatically. Use a separate directory and database.

| Path | What you edit or run |
|---|---|
| README.md | Quick start and navigation |
| app and web | Editable backend and frontend source |
| app/schema.sql | Version-one database schema |
| compose.yaml and Dockerfile | Container services and build |
| .env.example | Local configuration template and commented future host settings |
| deploy/Caddyfile | Commented future HTTPS and www redirect blocks |
| scripts | Environment initialization, account management, checks, backup and restore |
| tests | Business rule and authorization tests |
| docs | Detailed guide, API inventory, data dictionary, feature scope and verification |
| .github/workflows and Jenkinsfile | CI examples; they do not deploy to your cloud account |

## 4 Check prerequisites

Run these commands before starting. Docker must be running, not just installed. Use the current official Docker installation instructions for your operating system if a command is missing.

```bash
docker version
docker compose version
python3 --version
```

Expected: docker version shows both Client and Server; Compose reports v2; Python reports version 3. For Python-only development use Python 3.12. For the Docker path Python only runs the standard-library helper scripts. The VM needs internet access to download base images and Python packages. Network proxies, registry limits and cloud firewall rules can affect the first build.

## 5 Start locally with Docker

Open the extracted sevenbyeleven directory in your terminal. Confirm that compose.yaml is present with ls. Then run the commands below one at a time.

```bash
python3 scripts/init-env.py
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 180
python3 scripts/smoke.py
```

The first command creates .env and generates a random database password. It preserves an existing .env. Do not manually copy CHANGE_ME_WITH_INIT_ENV as a real password. The second command should exit without errors. The third builds the app, starts PostgreSQL, waits for the database, and checks app readiness. The final command should print PASS for liveness, readiness, catalog and stores.

Open http://localhost:3000 exactly. Do not use your machine's LAN IP with the default host configuration. The storefront should display 7by11.com, search, categories and products. If startup times out, run docker compose ps and docker compose logs --tail=100; slow downloads are different from application errors.

The .env file is read by Compose, not by python run.py. Changing .env requires recreating the relevant container with docker compose up -d. A restart alone does not apply new environment values. Keep .env out of Git and do not post its contents in screenshots.

## 6 Sign in and understand each workspace

Every seeded account below uses the private-lab password 7by11Demo!2026. Use separate browser profiles or private windows to test multiple roles. The authentication token is kept in memory, so refreshing the page signs out the tab. This is intentional in this release; your saved cart and orders remain in the database.

| Email | Role and visible workspace |
|---|---|
| customer@example.com | Shopping, saved items, orders, profile, tickets and notifications |
| seller@example.com | Everyday Studio catalog, orders, returns, finance and staff |
| seller2@example.com | Home Collective, isolated from the first seller |
| admin@example.com | All stores, moderation, delivery assignment, users, coupons and audit |
| delivery@example.com | Only tasks assigned to this delivery account |
| warehouse@example.com | Packing and return receipt/quality work |
| support@example.com | Shared support ticket queue |
| finance@example.com | Seller payout request review |

Customer registration cannot grant an admin role. New users register as customers. They can apply for a store from My account; an administrator must approve it. Store owners can grant an existing user's account catalog, fulfillment or finance permission for that store. Seller accounts retain access to their personal shopping cart and orders. Global roles are created through the server-side account command, not customer registration.

## 7 Perform the complete order walkthrough

Step 1: Sign in as customer, open a product, add it to the bag, and proceed to checkout. Enter a delivery address or use a saved one. Choose demo payment or demo COD. WELCOME10 applies once per customer to eligible orders of at least INR 1000, with a maximum INR 500 discount. Submit the order once and wait for its confirmation.

Step 2: Open Orders. Every purchased product line starts as confirmed. If products belong to different stores, the customer still sees one order while each seller sees only their own lines. You can cancel a confirmed line before it is packed; cancellation restores stock once.

Step 3: In a separate profile sign in as the matching seller. Open Workspace, then Orders, and pack the line. The state changes to packed. A warehouse account may also perform this packing step.

Step 4: Sign in as admin. Assign the packed line to delivery. For the seeded account, the delivery user ID is delivery. For a new account use its actual ID shown in the admin users list, not its email.

Step 5: Sign in as delivery, open Workspace and start the assigned task. The line changes to out_for_delivery. A failed attempt can be recorded with a reason without completing delivery.

Step 6: Return to the customer's Orders screen and generate a delivery code for that line. Share it only with the delivery person during the test. The code expires after ten minutes. In the delivery workspace enter it and confirm collection for COD. The API limits wrong attempts; the customer can generate a new code if required.

Step 7: Complete delivery. The customer now sees delivered, can submit a verified review and can request a return. A demo earning is recorded for the seller. Admin must approve the review before it appears publicly.

Step 8: Request a return with a reason as the customer. As seller or warehouse, confirm physical receipt, inspect the goods, and choose restock or quarantine when recording the demo refund. The line becomes refunded. Restock restores inventory once; quarantine does not. No money moves through a payment provider.

Step 9: For a separate delivered line that has not been returned, open the seller Finance tab and request a payout. Sign in as finance or admin to review it. The approver cannot be the requester, and earnings are rechecked before marking it paid_demo. This is a simulated record, not a bank transfer.

## 8 Manage a seller catalog

A seller creates a product draft using a unique SKU within that store. Supply name, category, price, MRP, stock and description. Price must be positive and MRP cannot be lower than price. Initial stock is a starting quantity; later adjustments require a signed quantity change and a reason. A negative change removes stock and cannot make the balance negative.

Admin reviews the listing. After approval, the seller activates it. Customers only see active, approved products from active stores. Delisting hides the product and prevents stale carts from buying it; it does not delete historical orders. Archiving is also a status change. Editing the name, description or image requires another moderation review. Image uploads accept supported raster formats, are size limited and are re-encoded as JPEG.

Product updates use a version number. If two people edit the same product, a stale update returns a conflict rather than silently overwriting the other person's work. Reload the screen, check the current data and retry intentionally. Existing order lines retain their purchase-time price even when the catalog price changes.

The current product model represents one seller-owned offer. It does not contain a shared Amazon-style catalog, buy-box or independent size/color variant stock. Use distinct SKUs for separate offers in this release. The full data dictionary and API inventory are in docs/DATA.md and docs/API.md.

## 9 Deploy to a cloud VM without a domain

Use a Linux VM on AWS, Azure, GCP, DigitalOcean or another provider that supports Docker Engine and persistent disk. The commands below assume your VM already exists and Docker with Compose is installed. They do not provision or charge for resources. Provider IAM, VM provisioning, SSH keys and firewall configuration remain your responsibility.

Allow SSH only from your trusted public IP. Keep port 3000 closed to the internet and do not publish PostgreSQL port 5432. Copy the source ZIP to the VM using scp or your provider's secure file transfer. Example placeholders are shown below.

```bash
scp 7by11_Marketplace_Source.zip ubuntu@SERVER_IP:~/
ssh ubuntu@SERVER_IP
unzip 7by11_Marketplace_Source.zip
cd sevenbyeleven
python3 scripts/init-env.py
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 180
python3 scripts/smoke.py
```

Expected: the smoke check passes on the VM. Now leave that SSH session and open a tunnel from a terminal on your laptop. Keep the tunnel terminal open while browsing.

```bash
ssh -N -L 3000:127.0.0.1:3000 ubuntu@SERVER_IP
```

Open http://localhost:3000 on your laptop. If a local marketplace is already using port 3000, stop its Compose stack first. Do not switch randomly to another port: the browser Origin must match the configured PUBLIC_ORIGIN. You can deliberately change it, but keeping port 3000 avoids that extra configuration.

## 10 Prepare accounts before public exposure

For a fresh non-demo environment, set SEED_DEMO=false in .env before the first startup. The database will start empty. Create your administrator interactively using the container command below, choosing role admin and a unique strong password. Create staff accounts with the same command and appropriate roles. It prompts for email, password, display name and role.

```bash
docker compose exec app python scripts/manage.py create-user
```

For a database that already contains demo data, first create and verify a new non-demo admin account. Then set SEED_DEMO=false in .env, recreate the app, and disable the seeded accounts. Disabling preserves their historical orders; it does not delete sample products or stores. Suspend the sample stores through your new admin account if they must disappear from the catalog.

```bash
docker compose up -d app
docker compose exec app python scripts/manage.py disable-demo
```

Verify that the new admin can sign in and the seeded passwords no longer work. Keep the database private and use a secrets manager or restricted environment configuration for a commercial deployment. Existing database credentials do not change merely by editing POSTGRES_PASSWORD in .env; changing a live database password needs a coordinated database credential rotation.

## 11 Enable the future domain and HTTPS

This section is optional until you own 7by11.com. Branding text already works without DNS. The two places with future host behavior are .env and deploy/Caddyfile. You do not need to edit product screens or API URLs.

Step 1: Purchase the domain and allocate a stable public IP for the server. Add an A record for the root name to that IP. Add www as a CNAME to the root or as another A record. Only add AAAA when IPv6 routing really works. Wait until both names resolve to your intended server.

Step 2: Allow inbound TCP 80 and 443 at the cloud firewall and operating-system firewall. Keep the app and database ports private. Complete the account hardening steps before making the service reachable.

Step 3: Open .env. Uncomment the two future lines below, removing the leading # and space. Remove or comment the earlier local values for clarity. Keep the values exactly as shown; PUBLIC_ORIGIN has the scheme while ALLOWED_HOSTS has hostnames only.

```text
PUBLIC_ORIGIN=https://7by11.com
ALLOWED_HOSTS=7by11.com,www.7by11.com,localhost,127.0.0.1
```

Step 4: Open deploy/Caddyfile and uncomment the complete 7by11.com and www.7by11.com blocks, including their braces. Leave the explanatory comments as comments. The www block redirects to the root site. Use the following commands to validate and enable the profile.

```bash
docker compose --profile domain run --rm --no-deps proxy \
  caddy validate --config /etc/caddy/Caddyfile
docker compose --profile domain up -d --build
docker compose logs --tail=100 proxy
```

Step 5: Open https://7by11.com, verify the certificate, sign in, and perform a private test purchase. Confirm that https://www.7by11.com redirects to the root. The in-container health check still uses localhost, which is why localhost remains in ALLOWED_HOSTS.

If certificate issuance fails, check DNS, incorrect AAAA records, port forwarding, firewall rules and Caddy logs. Do not repeatedly restart while issuance is being rate limited. Caddy certificate data is persisted in its named volume. Do not delete that volume casually. Uncommenting alone cannot buy the domain or configure its DNS.

## 12 Daily operation and backups

Run these read-only checks from the project directory. Health checks confirm process/database reachability, not every business workflow.

```bash
docker compose ps
python3 scripts/smoke.py
docker compose logs --tail=100 app
docker compose logs --tail=100 postgres
```

The API returns an X-Request-ID header. Match it to structured application logs when investigating errors. Logs must not be treated as permanent audit storage. The audit table records important business actions. The /metrics route exposes a basic availability gauge only; there are no latency dashboards or complete business metrics in this release.

Create a database backup before every upgrade and on a schedule appropriate to your recovery needs. The script writes a PostgreSQL custom-format dump to backups with a UTC timestamp. Confirm the file is nonempty, then copy it to protected storage outside the VM. A backup on the same VM cannot protect against VM/disk loss. Because uploaded images are stored in the database, the dump includes them.

```bash
bash scripts/backup.sh
ls -lh backups
```

Restore only into an intended recovery environment or during an approved outage. The restore command replaces database contents and prompts for RESTORE. It stops the app to prevent new writes. If restore fails, the app remains stopped so you can investigate rather than serving partially restored data.

```bash
bash scripts/restore.sh backups/YOUR_BACKUP_FILE.dump
python3 scripts/smoke.py
```

After restoration, sign in and inspect a known order, stock count and image. Restore testing is required; the existence of a dump does not prove recoverability. Choose and document your recovery point and recovery time targets after measuring your own environment.

## 13 Update and roll back safely

Record the running release, save .env securely and take a database backup. Extract the new source into a separate directory for review, then update the deployed source while retaining the same Compose project name and environment. Build and restart with the command below, inspect health and perform a small manual walkthrough.

```bash
docker compose up --build -d --wait --wait-timeout 180
python3 scripts/smoke.py
```

Keep the previous source/image and backup. Roll back code by restoring the previous release and rebuilding. If a future release changes the schema incompatibly, code rollback alone is not enough: follow that release's migration/restore procedure. This release only bootstraps schema version one and has no general-purpose incremental migration runner.

For ordinary shutdown use docker compose down. Named volumes remain. Do not use docker compose down -v on a database you want to keep: -v deletes the named volumes. A clean reset is appropriate only for disposable lab data after verifying your backups.

## 14 Run tests and CI

Create a Python 3.12 virtual environment, activate it, install requirements-dev.txt and run pytest. By default the tests use temporary SQLite databases and do not modify your local running app. If DATABASE_URL is set, the fixture drops the public schema of that database. Never use a live or shared database URL for tests.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
unset DATABASE_URL
python -m pytest -q
```

The included GitHub Actions workflow runs Python syntax checks, JavaScript parsing, SQLite tests, isolated PostgreSQL tests, a Compose build/smoke check and a Trivy image scan. It runs after you put the source in a GitHub repository with Actions enabled. A vulnerability scan can correctly fail when newly discovered vulnerabilities appear; patch and rebuild rather than disabling the gate. The Jenkinsfile is an alternative starting point for a disposable agent with Docker access. Neither pipeline automatically publishes images or deploys to your cloud account.

See docs/VERIFICATION.md for checks actually executed while building this package and checks that still need to run on your Docker host. A test suite reduces known risks but cannot guarantee an error-free environment or Internet-scale capacity.

## 15 Troubleshooting by symptom

| Symptom | Check and next action |
|---|---|
| Docker daemon unavailable | Start Docker Desktop/Engine; check docker version Server section and WSL integration |
| Port 3000 already allocated | Stop the other local stack or tunnel; preserve the documented port and origin |
| POSTGRES_PASSWORD required | Run scripts/init-env.py from the project root; confirm .env exists |
| Database password authentication failed | Existing volume password differs from .env; recover original credentials or rotate deliberately; do not erase valuable data |
| App is unhealthy | Inspect app/postgres logs and compose ps; check database readiness and dependency download failures |
| Invalid Host error | Use localhost for local mode; ensure future hostname is in ALLOWED_HOSTS and recreate the app |
| Origin not allowed | Match browser scheme, hostname and port to PUBLIC_ORIGIN; recreate after .env edits |
| Sign-in lost after refresh | Expected memory-only token behavior; sign in again |
| Seller product invisible | Check store active, product approved, product active and available stock |
| Price changed or conflict | Reload cart/product and review the new price/version before retrying |
| Delivery completion denied | Check assigned user, out_for_delivery state, fresh customer code and COD confirmation |
| Payout denied | Check different approver, pending request and current earnings after refunds |
| HTTPS does not work | Verify DNS, AAAA, public IP, ports 80/443 and Caddy logs |
| Build cannot pull Python image | Check registry connectivity, DNS/proxy/rate limits; retry docker pull python:3.12-slim |

For an unexpected 500, record the request ID, timestamp, action and sanitized logs. Do not share .env, bearer tokens, passwords, customer addresses or backup dumps in public support requests. Fix the specific failed checkpoint before moving to the next deployment step.

## 16 Security and functional limits

The release includes hashed passwords, hashed session tokens, expiry, login attempt limits, origin checking, security headers, parameterized SQL, seller ownership checks and transaction protection. It does not include email verification, password recovery delivery, MFA, centralized IP rate limiting, a WAF, formal penetration testing or complete abuse controls. For an internet-facing marketplace these require implementation and review.

Write transactions are globally serialized in PostgreSQL to protect this early version's order/stock invariants. This is a throughput constraint; adding app containers does not make it a flash-sale system. Images are encoded in database records for portability. At scale move them to object storage/CDN with controlled upload access. Returns are whole-line only; tax invoices, real shipping rates, live GPS and real financial reconciliation remain unimplemented.

Real payment integration must create provider orders on the server, verify signed webhooks, deduplicate events, reconcile payment state and handle asynchronous refunds. Do not merely rename the demo button or change PAYMENT_MODE to live. A non-demo PAYMENT_MODE deliberately blocks checkout in this release. Add provider sandbox tests before handling money.

## 17 Final deployment checklist

Confirm each item before calling your private deployment complete: the correct release is extracted; .env exists with generated database credentials; both containers are healthy; the smoke script passes; the storefront opens; seller isolation works; one order completes through delivery; cancellation restores stock; a received return can be refunded once; a backup has been restored in a test environment; and the known feature limits are understood.

Before public access, additionally verify unique staff credentials, disabled demo accounts, hidden sample stores, domain ownership/DNS, trusted host/origin configuration, HTTPS, off-server backups and the operational/security integrations required for your actual business. Purchasing a domain does not make the simulated payment system production-ready.

## 18 Reference material

Source of truth for fields: app/schema.sql and docs/DATA.md. Source of truth for routes: app modules and docs/API.md. Feature status: docs/FEATURES.md. Exact verification status: docs/VERIFICATION.md. All of these files are editable and included in the ZIP.

Official documentation for environment-specific installation and behavior: https://docs.docker.com/engine/install/ ; https://docs.docker.com/compose/ ; https://flask.palletsprojects.com/en/stable/deploying/ ; https://docs.gunicorn.org/ ; https://caddyserver.com/docs/automatic-https ; https://www.postgresql.org/docs/17/backup-dump.html . Consult the current provider documentation when provisioning your VM or installing Docker.
