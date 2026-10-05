# API reference

All paths are relative to the same host that serves the UI. JSON requests use Content-Type: application/json. Authenticated routes require Authorization: Bearer <session-token>. Tokens expire after one hour. IDs are opaque strings, not array indexes. Money is integer paise; timestamps are Unix seconds. The browser implementation in web/app.js supplies working request examples.

Responses: 200 success, 201 created, 401 sign in required, 403 forbidden, 404 absent or inaccessible, 409 state/version conflict, 422 invalid input, 429 login limit, 503 real provider not configured. Errors are JSON {"error":"message"}. Check status before reading a success payload.

## Accounts

| Method and path | Access | JSON request fields read by handler |
|---|---|---|
| `POST /api/register` | Public | email, name, password, role |
| `POST /api/login` | Public | email, password |
| `GET /api/me` | Signed in; ownership checked in handler | None / see notes |
| `POST /api/logout` | Signed in; ownership checked in handler | None / see notes |
| `PATCH /api/me` | Signed in; ownership checked in handler | name |
| `POST /api/me/password` | Signed in; ownership checked in handler | current, password |
| `GET, POST /api/addresses` | Signed in; ownership checked in handler | address, label |
| `DELETE /api/addresses/<id>` | Signed in; ownership checked in handler | None / see notes |
| `GET, POST /api/notifications` | Signed in; ownership checked in handler | None / see notes |
| `GET, POST /api/tickets` | Signed in; ownership checked in handler | message, subject |
| `POST /api/tickets/<id>` | Signed in; ownership checked in handler | message, status |

## Catalog

| Method and path | Access | JSON request fields read by handler |
|---|---|---|
| `GET /api/products` | Public | None / see notes |
| `GET /api/products/<id>` | Public | None / see notes |
| `GET, POST /api/wishlist` | Signed in; ownership checked in handler | product_id, remove |
| `POST /api/products/<id>/reviews` | customer, seller | body, rating |
| `GET, POST /api/seller/stores` | Signed in; ownership checked in handler | description, name |
| `PATCH /api/seller/stores/<id>` | Signed in; ownership checked in handler | description, name |
| `GET, POST /api/seller/stores/<id>/members` | Signed in; ownership checked in handler | email, permission |
| `GET, POST /api/seller/products` | Signed in; ownership checked in handler | attributes, brand, category, description, mrp, name, price, sku, stock, store_id |
| `PATCH /api/seller/products/<id>` | Signed in; ownership checked in handler | description, mrp, name, price, status, version |
| `POST /api/seller/products/<id>/stock` | Signed in; ownership checked in handler | delta, reason, version |
| `POST /api/seller/products/<id>/image` | Signed in; ownership checked in handler | None / see notes |
| `GET /api/media/<id>` | Public | None / see notes |
| `GET /api/stores` | Public | None / see notes |

## Commerce

| Method and path | Access | JSON request fields read by handler |
|---|---|---|
| `GET, POST /api/cart` | customer, seller | product_id, quantity |
| `POST /api/checkout` | customer, seller | address, coupon, items, method |
| `GET /api/orders` | customer, seller | None / see notes |
| `GET /api/orders/<id>/invoice` | customer, seller | None / see notes |
| `POST /api/items/<id>/cancel` | customer, seller | None / see notes |
| `POST /api/items/<id>/return` | customer, seller | reason |
| `POST /api/items/<id>/delivery-code` | customer, seller | None / see notes |
| `GET /api/seller/orders` | Signed in; ownership checked in handler | None / see notes |
| `POST /api/seller/items/<id>/pack` | Signed in; ownership checked in handler | None / see notes |
| `GET /api/seller/returns` | Signed in; ownership checked in handler | None / see notes |
| `POST /api/returns/<id>/resolve` | Signed in; ownership checked in handler | action, disposition |

## Operations

| Method and path | Access | JSON request fields read by handler |
|---|---|---|
| `GET /api/admin/overview` | admin | None / see notes |
| `POST /api/admin/stores/<id>` | admin | reason, status |
| `POST /api/admin/products/<id>` | admin | reason, status |
| `POST /api/admin/users/<id>` | admin | reason, status |
| `POST /api/admin/reviews/<id>` | admin | status |
| `POST /api/admin/coupons` | admin | code, days, max_discount, max_uses, minimum, percent |
| `POST /api/admin/items/<id>/assign` | admin | courier_id |
| `GET /api/delivery/tasks` | delivery | None / see notes |
| `POST /api/delivery/tasks/<id>` | delivery | action, cod_collected, code, reason |
| `GET /api/warehouse/tasks` | warehouse, admin | None / see notes |
| `GET /api/seller/stores/<id>/finance` | Signed in; ownership checked in handler | None / see notes |
| `POST /api/seller/stores/<id>/payouts` | Signed in; ownership checked in handler | None / see notes |
| `GET /api/finance/payouts` | admin, finance | None / see notes |
| `POST /api/finance/payouts/<id>` | admin, finance | status |

## Special request rules

GET /api/products accepts q, category, sort (new, price_asc, price_desc), and page starting at 1; 24 records per page. Product create categories are Electronics, Fashion and Home. Product image upload uses multipart/form-data with field image, rather than JSON. DELETE address uses its path ID. POST notifications marks all your notifications read. Stock delta is signed; version is required for product and stock updates.

Checkout requires Idempotency-Key with 8–100 characters, address with 10–500 characters, method demo or cod, optional coupon and items containing id/quantity/price. Build items from GET /api/cart in its returned order (product ID ascending). Send an unchanged key and payload only to retry the same checkout. A new intent needs a new key. Do not generate another key after a network timeout without checking your Orders first.

Store member permission is catalog, fulfillment, finance or remove. Product lifecycle is draft, active, paused, archived; moderation is pending, approved, suppressed or rejected. Delivery actions are start, attempt_failed (reason), complete (code and boolean cod_collected). Return resolution is receive or refund (disposition restock or quarantine). Payout approval status is paid_demo or rejected.

The field inventory reports fields read by each route, not that every field is mandatory. Exact defaults, limits and state transitions are implemented in the named module. No OpenAPI contract or SDK is included.