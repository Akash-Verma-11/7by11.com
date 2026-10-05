# Feature coverage

## Implemented in this release

| Area | Available behavior |
|---|---|
| Customer | Register, login, password change, addresses, search/category/sort, product details, wishlist, cart, coupon checkout, split seller order lines, order status, cancellation before packing, delivery code, whole-line returns, verified reviews, support tickets and notifications |
| Seller | Apply for store approval; manage own stores; draft products, submit for moderation, activate approved listings, delist/archive, edit price and descriptions, upload sanitized images, adjust stock with reason and version check, pack own orders, receive returns and record demo refunds, scoped store staff, earnings and payout requests |
| Admin | Approve/suspend/reject stores; approve/suppress/reject products; suspend accounts; moderate reviews; create coupons; assign delivery persons; inspect orders and audit log; review demo payouts |
| Delivery | Assigned tasks only, necessary delivery address, start delivery, log failed attempt, validate customer delivery code, record COD collection and complete delivery |
| Warehouse | Shared packing queue, return receipt and quality disposition; this pilot allows warehouse staff to record the related simulated refund |
| Support | View and reply to all support tickets; resolve/reopen via status |
| Finance | Review payout requests, prevent same-person approval, recheck earnings before simulated payment |
| Integrity | Transactions, checkout idempotency, stale quote detection, nonnegative stock, role and store ownership checks, optimistic product versions, duplicate refund protection |
| Operations | Health/readiness routes, structured request logs, Compose health checks, backup/restore scripts, GitHub Actions and Jenkins CI examples |

## Simulations and simplified policies

Checkout accepts `demo` or `cod`, but both are lab records. It does not contact a payment gateway. COD collection is a checkbox, not a reconciled cash ledger. Refunds and payouts change local records only. The receipt is not a compliant tax invoice. Delivery is assigned manually, without carrier API, maps or live GPS. Notifications are in-app only. Seller earnings use an illustrative fixed 90% of each delivered discounted line, reversed on refund; this is not double-entry accounting. Do not interpret these records as bank balances.

Returns cover the complete purchased line quantity, with physical receipt before refund and restock/quarantine choice. There is no automated return deadline or exchange workflow. Cancellation is allowed only while confirmed. Coupons are once per customer and are not automatically released after cancellation. A product is a seller-owned offer with a SKU and attributes; shared catalog variants, multiple offers per canonical product and a buy-box are not implemented.

## Remaining before a commercial marketplace launch

Real gateway order creation, signed webhook verification, payment state reconciliation, refund API and retry/outbox workers; real courier labels and tracking; seller identity/tax/bank verification; tax calculation and compliant invoices; fraud controls and MFA; verified email/mobile and password reset; payment disputes; partial returns/replacements; shipping zones/fees and serviceability; settlements with a return hold period and reconciliation; backups off the VM with tested recovery; privacy and retention controls; load tests and an independent security review.

## Larger marketplace additions

Recommendations, full-text search/search engine, product variants, comparison, loyalty, gift cards, subscriptions, flash-sale queues, advertising, seller bulk CSV import, multiple warehouses/reservations, reverse logistics, regional languages, mobile apps, analytics, abandoned-cart email, real-time chat and marketplace campaigns remain roadmap items. None is presented as working in this source.

## Scale boundary

Every write transaction takes one PostgreSQL advisory lock (or a SQLite immediate transaction). This protects the early release from concurrent inventory and payout races but serializes writes. Adding replicas will not remove that limit. Before heavy traffic, introduce tested row-level locks, reservation expiry, a payment/outbox worker, connection pooling, object storage/CDN and workload-based capacity testing. There are no automatic schema upgrades beyond version-one bootstrap.
