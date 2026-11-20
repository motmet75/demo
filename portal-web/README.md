# Portal Web (standalone public website, no Vaadin)

This module is a **first migration slice**, not a production-ready replacement for the existing Portal application.

## Goal

- Keep `demo` (Spring Boot admin/API) on its existing port and context path.
- Start a **separate** tiny Spring Boot + Thymeleaf JAR for public website rendering.
- Read existing live HTML from `/opt/portal-live/templates` and browser assets from `/opt/portal-live/static`.
- Read website-to-theme mapping from the existing Portal `xml/config.xml`.
- Never copy, edit, overwrite, or check in any server-side live theme or configuration.
- Never include Vaadin, Redis, admin login/session, or tenant datasource credentials in this JAR.

## Build and run independently

```bash
cd /opt/tuonghoa/demo/portal-web
mvn clean package -DskipTests
java -jar target/portal-web-0.1.0-SNAPSHOT.jar
```

Default bind: `127.0.0.1:8083`; health `http://127.0.0.1:8083/healthz`.
Optional environment variables:

```text
PORTAL_WEB_PORT=8083
PORTAL_WEB_BIND=127.0.0.1
PORTAL_LIVE_ROOT=/opt/portal-live
PORTAL_CONFIG_XML=/opt/tuonghoa/portal/xml/config.xml
```

Local-only test of tenant routing (Nginx must supply the correct Host when deployed):

```bash
curl -i http://127.0.0.1:8083/healthz
curl -i -H 'Host: anhmedia.vn' http://127.0.0.1:8083/
curl -I -H 'Host: anhmedia.vn' http://127.0.0.1:8083/anhmedia.vn/css/anhmedia-live-2026.css
```

## IMPORTANT: production blockers before redirecting domain traffic

1. Port `GreetingController` page models and routes (home, article/product list/detail, cart, auth), preserving tenant-specific behavior and SEO.
2. Add read-only data access to the required `demo` portal-content services or a secured private API. The initial renderer uses empty collections and placeholder `page` metadata, NOT live product/article content.
3. Compare rendered page HTML and links with the existing Portal on at least two tenants; test images, JS, CSS, MIME types, fragments and localized routes.
4. Ensure the service user can **read** `/opt/portal-live` and `xml/config.xml`. It must not require write access to either directory.
5. Run this service alongside the old Portal before switching Nginx. Existing Portal/admin must remain online until parity tests pass.
6. Behind Nginx, accept forwarded Host/proto only from trusted proxy paths. Do not expose a public route to arbitrary local files.
7. Do not expose admin routes or file-management APIs from the public website service.

## Current QR ordering split

The repository already includes `bom-frontend/order-buffer-service`, an independent Java 17 HTTP server
(default dev proxy target port 8082) that uses Redis to buffer new orders while the main Demo API restarts.
The React `bom-frontend/vite.config.js` already proxies selected public-order endpoints to 8082.
**This is not yet a full independent order engine**: `ShopOrderController`, `ShopOrderService`,
Redis pending-order/draft caches, inventory and checkout transactions still reside in the Demo API.

Safe migration plan: keep the current order-buffer process running, move the customer-facing
shopfront React build into an independent static deployment, then extract the order service
together with its dependencies and transactional boundary into its own Boot module.
Keep BOM/invoice/tenant administration in Demo and expose private authenticated APIs for
admin-to-order communication. No database or Redis migration is attempted by this branch.
