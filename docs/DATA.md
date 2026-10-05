# Complete data dictionary

Read this with app/schema.sql for constraints and foreign keys. Currency is INR stored as integer paise. Timestamps are UTC Unix seconds. The application generates string IDs. Fields ending _id reference the named entity unless noted. There are no automatic cascade deletes; historical order records are retained.

## migrations

| Field | SQL type | Meaning |
|---|---|---|
| version | INTEGER | Optimistic edit counter, or schema version in migrations |
| applied | BIGINT | Schema bootstrap Unix time |

## users

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| email | TEXT | Normalized sign-in email; unique for users |
| name | TEXT | Display name or purchase-time item name |
| password | TEXT | Werkzeug password hash; never plaintext |
| role | TEXT | Global account role |
| status | TEXT | Entity lifecycle; see status rules below |
| created | BIGINT | Creation Unix time in seconds |

## sessions

| Field | SQL type | Meaning |
|---|---|---|
| token | TEXT | SHA-256 hash of opaque session token |
| user_id | TEXT | User record ID |
| expires | BIGINT | Expiry Unix time in seconds |

## login_attempts

| Field | SQL type | Meaning |
|---|---|---|
| email | TEXT | Normalized sign-in email; unique for users |
| attempts | INTEGER | Failed login count in current window |
| reset_at | BIGINT | Login throttle reset time |

## stores

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| owner_id | TEXT | Store owner user ID |
| name | TEXT | Display name or purchase-time item name |
| description | TEXT | Human-readable store/product text |
| status | TEXT | Entity lifecycle; see status rules below |
| reason | TEXT | Moderation, stock adjustment or return explanation |
| version | INTEGER | Optimistic edit counter, or schema version in migrations |

## members

| Field | SQL type | Meaning |
|---|---|---|
| store_id | TEXT | Store record ID |
| user_id | TEXT | User record ID |
| permission | TEXT | Store membership permission |

## products

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| store_id | TEXT | Store record ID |
| name | TEXT | Display name or purchase-time item name |
| category | TEXT | Electronics, Fashion or Home |
| brand | TEXT | Product brand label |
| description | TEXT | Human-readable store/product text |
| attributes | TEXT | JSON object of descriptive attributes; not separate variant stock |
| sku | TEXT | Seller SKU, unique within store |
| price | BIGINT | Unit price in integer paise |
| mrp | BIGINT | Reference price in paise, at least price |
| stock | INTEGER | Available units, never negative |
| status | TEXT | Entity lifecycle; see status rules below |
| moderation | TEXT | Admin review decision |
| image | TEXT | Seed image key or media record ID |
| version | INTEGER | Optimistic edit counter, or schema version in migrations |
| created | BIGINT | Creation Unix time in seconds |

## stock_moves

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| product_id | TEXT | Product record ID |
| delta | INTEGER | Signed stock unit adjustment |
| reason | TEXT | Moderation, stock adjustment or return explanation |
| actor | TEXT | User responsible for event |
| created | BIGINT | Creation Unix time in seconds |

## media

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| owner | TEXT | Uploader user ID |
| mime | TEXT | Sanitized image MIME type |
| data | TEXT | Base64-encoded JPEG bytes |

## addresses

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| user_id | TEXT | User record ID |
| label | TEXT | Saved address nickname |
| address | TEXT | Delivery address text, snapshotted on order |

## wishlist

| Field | SQL type | Meaning |
|---|---|---|
| user_id | TEXT | User record ID |
| product_id | TEXT | Product record ID |

## carts

| Field | SQL type | Meaning |
|---|---|---|
| user_id | TEXT | User record ID |
| product_id | TEXT | Product record ID |
| quantity | INTEGER | Units; cart limit 1–20 |

## coupons

| Field | SQL type | Meaning |
|---|---|---|
| code | TEXT | Uppercase coupon code |
| percent | INTEGER | Coupon discount percentage, 1–80 |
| max_discount | BIGINT | Discount ceiling in paise |
| minimum | BIGINT | Minimum subtotal in paise |
| max_uses | INTEGER | Global redemption cap |
| uses | INTEGER | Global redeemed count |
| active | INTEGER | Integer boolean activation flag |
| expires | BIGINT | Expiry Unix time in seconds |

## orders

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| user_id | TEXT | User record ID |
| address | TEXT | Delivery address text, snapshotted on order |
| total | BIGINT | Amount in paise; line total includes allocated coupon |
| discount | BIGINT | Order coupon reduction in paise |
| coupon | TEXT | Applied coupon code or empty string |
| payment | TEXT | paid_demo or cod_due; never provider confirmation |
| created | BIGINT | Creation Unix time in seconds |

## order_items

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| order_id | TEXT | Order record ID |
| store_id | TEXT | Store record ID |
| product_id | TEXT | Product record ID |
| name | TEXT | Display name or purchase-time item name |
| quantity | INTEGER | Units; cart limit 1–20 |
| price | BIGINT | Unit price in integer paise |
| total | BIGINT | Amount in paise; line total includes allocated coupon |
| status | TEXT | Entity lifecycle; see status rules below |
| courier_id | TEXT | Assigned delivery user ID or null |
| otp_hash | TEXT | Hashed delivery code, never returned in order lists |
| otp_attempts | INTEGER | Wrong delivery-code attempts |
| otp_expires | BIGINT | Delivery-code expiry Unix time |
| cod_collected | INTEGER | Integer boolean collection assertion |
| created | BIGINT | Creation Unix time in seconds |

## checkout_keys

| Field | SQL type | Meaning |
|---|---|---|
| user_id | TEXT | User record ID |
| key | TEXT | Client checkout idempotency key |
| fingerprint | TEXT | Hash of normalized checkout request |
| order_id | TEXT | Order record ID |

## coupon_uses

| Field | SQL type | Meaning |
|---|---|---|
| user_id | TEXT | User record ID |
| code | TEXT | Uppercase coupon code |
| order_id | TEXT | Order record ID |

## returns

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| item_id | TEXT | Item record ID |
| reason | TEXT | Moderation, stock adjustment or return explanation |
| status | TEXT | Entity lifecycle; see status rules below |
| disposition | TEXT | pending, restock or quarantine |
| refund | BIGINT | Whole-line refundable amount in paise |
| created | BIGINT | Creation Unix time in seconds |

## ledger

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| store_id | TEXT | Store record ID |
| item_id | TEXT | Item record ID |
| kind | TEXT | sale or refund earning entry |
| amount | BIGINT | Signed ledger or payout value in paise |
| created | BIGINT | Creation Unix time in seconds |

## payouts

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| store_id | TEXT | Store record ID |
| amount | BIGINT | Signed ledger or payout value in paise |
| requested_by | TEXT | Payout requester user ID |
| status | TEXT | Entity lifecycle; see status rules below |
| approved_by | TEXT | Payout reviewer ID or null |
| created | BIGINT | Creation Unix time in seconds |

## reviews

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| user_id | TEXT | User record ID |
| product_id | TEXT | Product record ID |
| rating | INTEGER | Integer 1–5 |
| body | TEXT | Review text |
| status | TEXT | Entity lifecycle; see status rules below |
| created | BIGINT | Creation Unix time in seconds |

## tickets

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| user_id | TEXT | User record ID |
| subject | TEXT | Support ticket subject |
| status | TEXT | Entity lifecycle; see status rules below |
| messages | TEXT | JSON list of by/text/at message objects |
| created | BIGINT | Creation Unix time in seconds |

## notifications

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| user_id | TEXT | User record ID |
| message | TEXT | Notification text |
| seen | INTEGER | Integer boolean read flag |
| created | BIGINT | Creation Unix time in seconds |

## audit

| Field | SQL type | Meaning |
|---|---|---|
| id | TEXT | Opaque primary identifier |
| actor | TEXT | User responsible for event |
| action | TEXT | Audited operation name |
| entity | TEXT | ID affected by audit event |
| detail | TEXT | Audit context without credentials |
| created | BIGINT | Creation Unix time in seconds |

## Lifecycle and relational rules

users: active or suspended. stores: pending, active, suspended or rejected. products: draft, active, paused or archived, with a separate moderation status. order_items: confirmed → packed → out_for_delivery → delivered → return_requested → refunded; confirmed can instead become cancelled. returns: requested → received → refunded. payouts: pending → paid_demo or rejected. tickets: open or resolved. reviews: pending → approved or rejected.

One user can own multiple stores; membership grants a permission per user/store. One customer order has many seller-specific item lines. Each line references a product and freezes its name, unit price, quantity and discounted total. Each line can have one whole-line return. Ledger uniqueness prevents duplicate sale/refund entries per line. A checkout key is unique per user, and coupon use is unique per user/code.

Ledger entries are illustrative seller earnings, not general-ledger accounting. A paid payout followed by a later return can make available earnings negative; debt recovery and settlement hold periods are not implemented. Administrative ordered_value is gross ordered total before cancellations/refunds, not revenue.