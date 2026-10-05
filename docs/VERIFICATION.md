# Verification report

Release 1, 4 October 2026.

## Executed successfully

- 18 pytest groups on temporary SQLite databases: registration/privilege rejection, session revocation, origin and role checks, seller isolation, optimistic product versions, stale delisted carts, price/stock validation, repeated checkout, concurrent identical checkout, concurrent last-unit purchase, multiple sellers and line cancellation, delivery and return lifecycle, coupon allocation/reuse, store applications/scoped staff, address/wishlist/ticket ownership and review eligibility, payout balance changes after refund, sanitized media moderation, product approval and COD, finance packing denial with seller shopping, delivery-code lock and renewal, persistent login throttling.
- JavaScript syntax parsing using Node.
- jsdom interface integration: six catalog cards, customer add-to-bag and checkout, all eight seeded role sign-ins/workspace rendering, logout, and no script exceptions. This validates DOM behavior, not browser layout.
- HTTP smoke check against a running Python development server: health, database readiness, catalog, stores, storefront HTML, JavaScript, CSS and product image return successfully.

## Validation still required on the target environment

Run the included CI workflow for PostgreSQL execution, Docker build/Compose startup and image vulnerability scanning. Those infrastructure checks were not executed in the artifact-building environment. Test desktop/mobile browser layouts and complete the manual walkthrough on your actual deployment. No performance/penetration test, cloud deployment, live payment test or live courier test has been performed. No zero-error or production-scale claim is made.

The tests must use an isolated database. With DATABASE_URL set, the test fixture deletes the database public schema before each test. The HTTP smoke script is read-only and safe for an existing deployment.

## Consolidated package check — 4 October 2026

Re-ran all 18 SQLite test groups and the eight-account UI DOM integration check successfully. Checked application JavaScript, the added Bash launcher syntax and Python launcher compilation. All source, dependency manifests, schema, seed data, UI assets, deployment configurations and documentation are included in one root folder. Added START_HERE.md, Bash and PowerShell Docker launchers, and a Python-only local launcher. Docker/PostgreSQL startup and the PowerShell launcher still require verification on the target machine; Docker is unavailable in this build environment.
