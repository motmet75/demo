# Portal / Demo / QR: two public frontends, one admin

**Branch-only migration plan. Do not change production ports or replace existing services yet.**

| Process | Purpose | Suggested internal address |
| --- | --- | --- |
| `demo` existing Spring Boot | **Single admin:** BOM, inventory, invoices, shop management, Portal article/product management, users, social scheduling | `127.0.0.1:8081`, existing context `/sapi` |
| `portal-web` new independent Boot module | Public multi-tenant Thymeleaf website, themes in `/opt/portal-live`, no Vaadin | `127.0.0.1:8083` |
| Customer QR React build | Customer menu, QR table ordering, order status; independent static frontend | Nginx static files; no dedicated JS server required |
| Existing order-buffer-service | Redis-backed order queue and cached menu while demo service restarts | `127.0.0.1:8082` |
| Planned `shop-order-service` | Final independently running order API with Redis, PostgreSQL and transactional order domain | New port **after** extraction, not yet created |

## Ownership

- Admin (Demo) owns permissions, BOM, invoices, catalog edits, staff and social.
- Customer QR runtime eventually owns public menu reads, cart/draft/pending orders, order submission, order status and operational Redis keys.
- Website frontend (portal-web) serves only public HTML/assets and read-only product/article data; it never depends on Vaadin.
- PostgreSQL stays the source of truth for confirmed orders. Redis is ephemeral/cache/queue unless explicitly designed and backed up for durable pending work.
- Requests crossing processes carry verified tenant/company context; public order requests derive scope from trusted QR token, never trust arbitrary tenant headers.

## Cutover gates

1. Build portal-web independently. Confirm no Vaadin dependency; verify live theme read-only access.
2. Port Portal public `GreetingController` data bindings and routes to portal-web. Demo already has `PortalContentAdminController` for article/product CRUD, **not** the complete Portal admin feature set.
3. Keep existing Demo admin and order-buffer unchanged. Build and serve a separate customer QR-only React bundle; do not force customers to load the large admin/BOM bundle.
4. Inventory dependencies of `ShopOrderController`, `ShopOrderService`, `ShopPendingOrderCache`, `ShopOrderDraftCache` and transactional inventory reservations before extracting their code.
5. Put QR API behind a private contract with idempotency keys and replay-safe order creation; preserve existing Redis keys/TTL and pending-to-confirmed semantics.
6. Test network failure, queue replay, duplicate order prevention, refunds/cancels, checkout and counter notifications.
7. Deploy parallel services, health-check, switch Nginx **by path/domain**, and keep rollback routes.
8. Only then remove Vaadin admin from old Portal and retire the old Portal process.

### Existing resources: do not modify during first phase

`/opt/portal-live`, `/opt/tuonghoa/portal/xml/config.xml`, `/opt/tuonghoa/demo/secrets`,
`tenants/atRuntime`, current Nginx sites and all production Redis/PostgreSQL data.
