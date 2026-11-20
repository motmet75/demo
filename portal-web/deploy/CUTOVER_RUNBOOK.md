# Portal → standalone Portal Web + Demo: staged Nginx cutover

Status: **STAGING ONLY.** The initial `portal-web` currently implements just `/`,
`/home`, `/healthz`, live theme assets, hostname → template selection. It supplies
**empty product and article collections** and placeholder page metadata. This is
not ready for a blind full-domain cutover or shutdown of the Portal JAR.

## Architecture (Nginx existing public port mapping remains unchanged)

* Public `https://anhmedia.vn/` and other registered tenants → **8083**
  standalone `portal-web` (Spring Boot + Thymeleaf). DNS/domain and certificate stay as-is.
* `/bom-inventory/login`, `/bom-inventory/admin/*` → Nginx static admin React build,
  served at `/var/www/html/bom-inventory/`.
* `/bom-inventory/shop/*` → separate public customer React SPA build;
  `customer.html` (not admin `index.html`) and `customer-assets/*`.
* `/sapi/*` → **8081**, Demo Spring Boot. Keep any already-operating
  `/sapi/shop/public/...` order-buffer **8082** exceptions; do not bypass
  their Nginx regex with a new `^~ /sapi/` rule.
* Legacy Portal **8080** → transitional `/admin/*`,
  `/api/internal/tariff/*`, `/oauth2/*`, `/login/oauth2/*` and
  `/VAADIN/*` until corresponding functionality exists elsewhere.

**Your live Nginx config is not contained in Git.** The repo's
`WORKING_NGNIX_CONFIG.md` is only a historical snapshot. First inspect
`sudo nginx -T` and preserve current 443/8443, SSL, admin host, proxy,
WebSocket, body-size and existing order-buffer rules. **Do not overwrite
the entire Nginx server block with a repository example.**

## 1. Verify process status (no changes)

```bash
sudo ss -lntp | grep -E ':(8080|8081|8082|8083|8443|443)[[:space:]]' || true
curl -fsS http://127.0.0.1:8083/healthz
curl -sS -o /dev/null -w 'portal-web public HTML HTTP %{http_code}\n' \
  -H 'Host: anhmedia.vn' http://127.0.0.1:8083/
curl -sS -o /dev/null -w 'demo API HTTP %{http_code}\n' \
  http://127.0.0.1:8081/sapi/
```

A 401/403 on an authenticated Demo API route is normal; a connection refusal
means the backend is unavailable.

## 2. Prepare the independent React builds (feature branch)

Run in a checked-out worktree of `feature/portal-web-and-qr-service-split`
(e.g. `/opt/tuonghoa/demo-split-test`), not a production checkout still on
`main`.

```bash
cd /opt/tuonghoa/demo-split-test
git branch --show-current
git pull --ff-only origin feature/portal-web-and-qr-service-split

cd bom-frontend
npm ci
npm run build
npm run build:customer

# Backup existing deployed static directory before copying.
sudo cp -a /var/www/html/bom-inventory \
  "/var/www/html/bom-inventory.backup.$(date +%Y%m%d-%H%M%S)"

# Deploy BOTH distinct bundles. Do not let the customer HTML replace admin index.html.
sudo install -d /var/www/html/bom-inventory
sudo cp -a dist/. /var/www/html/bom-inventory/
sudo install -d /var/www/html/bom-inventory/customer-assets/assets
sudo cp -a dist-customer/assets/. /var/www/html/bom-inventory/customer-assets/assets/
sudo cp dist-customer/customer.html /var/www/html/bom-inventory/customer.html
```

Check filenames before production cutover:

```bash
test -s /var/www/html/bom-inventory/index.html
test -s /var/www/html/bom-inventory/customer.html
find /var/www/html/bom-inventory/customer-assets/assets -maxdepth 1 -type f | head
```

## 3. Edit only matching locations in the existing SSL 8443 server

```bash
sudo cp -a /etc/nginx/sites-available/tuonghoa \
  "/etc/nginx/sites-available/tuonghoa.bak.$(date +%Y%m%d-%H%M%S)"
sudo nginx -T 2>&1 | less
sudoedit /etc/nginx/sites-available/tuonghoa
```

Take the **location blocks** in
`portal-web/deploy/nginx-8443-routing.locations.conf`. Merge them into
the existing server context, replacing the old duplicate locations,
not pasting a second server block. **Preserve** the current public 443
front proxy to internal 8443 and certificates: never redirect browsers
to `:8443` or `:8433`. In the 8443 server, keep:

```nginx
absolute_redirect off;
port_in_redirect off;
```

and use `X-Forwarded-Proto https`, `X-Forwarded-Port 443`,
`X-Forwarded-Host $host`.

**Important:** `/bom-inventory/shop/*` must take precedence over the
generic `/bom-inventory/*` admin fallback; otherwise customers load the
admin React app instead of the independent customer bundle.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Test the same public URLs (and two separate tenant hosts)

```bash
curl -skI https://anhmedia.vn/
curl -skI https://anhmedia.vn/bom-inventory/login
curl -skI https://admin.anhmedia.vn/bom-inventory/login
curl -skI https://anhmedia.vn/bom-inventory/shop/menu
curl -skI https://anhmedia.vn/bom-inventory/customer-assets/assets/
curl -skI https://anhmedia.vn/anhmedia.vn/css/anhmedia-live-2026.css
curl -skI https://nncminhchau.vn/
curl -skI https://portal.tuonghoa-imex.com/admin/products/lazy-create
curl -skI https://portal.tuonghoa-imex.com/api/internal/tariff/hs/39269099
```

The `customer-assets/assets/` DIRECTORY itself may return 403/404 as
expected; confirm a **real hashed JS/CSS asset** from `customer.html`
returns HTTP 200. An authenticated admin/HS route may return 302/401/403
until signed in, but must not accidentally render the 8083 homepage.
Confirm the real pages, forms, images and CSS **in a browser** and check
network requests; HTTP 200 alone is not a content parity test.

Do not change all tenant domains before a two-tenant parity check.
If the site is missing product/article data, revert the public root
route to 8080 and continue the backend/frontend migration.

## 5. Modules to migrate, one by one

| Priority | Current state | Target / acceptance criteria |
|---|---|---|
| 0 | Demo already has `/bom-inventory/admin/portal-content` | Verify tenant/company-scoped article/product CRUD and permissions on 8081. |
| 1 | Portal `GreetingController` dynamic public pages | Port SEO metadata, article/product listings/details, shopping cart, localized URLs and read-only queries. Do **before** full public 8083 cutover. |
| 2 | Portal social publisher `/admin/products/lazy-create` | Add Demo admin feature including media upload, Page/LinkedIn/TikTok selections, scheduling, status, OAuth and secrets. |
| 3 | Portal `/api/internal/tariff/hs/{hsCode}` | Move protected HS lookup into Demo with dedicated DB connection; update callers, tests and scopes before removing 8080 location. |
| 4 | Portal OAuth/callbacks and authentication | Re-register redirects only when ready; transfer OAuth token/account management without leaking credentials; test live flows. |
| 5 | Remaining Portal Vaadin admin functionality | Move tickets, documents, customer/tenant management, templates, media operations as business-specific Demo React pages and APIs. |
| 6 | Old Portal 8080 is traffic-free | Remove old Nginx locations, prove regression tests, stop old JAR, monitor and preserve rollback. |

For each module: migrate API + data permissions + React UI + test tenant
isolation; then change *only that route*; then retire its legacy route.
**Do not modify `/opt/portal-live/templates`, `/opt/portal-live/static`
or Portal `xml/config.xml` while the standalone renderer still reads them.**

## 6. Stop old Portal **only after ALL remaining dependencies are migrated**

```bash
# Audit active 8080 connections/routes and processes first.
sudo ss -lntp | grep ':8080 ' || true
sudo nginx -T 2>&1 | grep -nE '8080|portal-th|/VAADIN|/admin|/oauth2'
# Confirm all 8080 references are intentionally removed/rewired before stopping.
cd /opt/tuonghoa/portal
./bin/portal-live.sh stop
sudo ss -lntp | grep ':8080 ' || echo "Legacy Portal 8080 stopped"
```

If the process is systemd-managed or separately launched, inspect its
exact unit/PID; **do not use `pkill java`** because Demo and portal-web
are Java services too. Do not delete the old Portal files: portal-web
still needs its XML config.

## Rollback

Restore the timestamped exact `/etc/nginx/sites-available/tuonghoa.bak.*`
you created (and the previous static build if changed), run
`sudo nginx -t && sudo systemctl reload nginx`, then
`/opt/tuonghoa/portal/bin/portal-live.sh start` if the old service was
stopped. Keep all application data and theme directories intact.
