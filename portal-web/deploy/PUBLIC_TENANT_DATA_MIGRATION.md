# Tenant-specific Thymeleaf content migration (staged, November 2026)

## What is implemented

The original `motmet75/portal` controller at
`src/main/java/com/vaadin/example/example/controller/GreetingController.java`
(`returnHomePage`) sets page, client, products, productsWithVideos,
catalogs, selectedHomeCatalogs, topCatalogs, brands, productGroups,
articles, spotlightArticles, pages, partners, projectMenuEntities,
templateImageMap and templateImages for each Portal tenant.

The standalone public renderer on **8083** now uses
`ThemeRegistry.findForHost()` to resolve hostname → tenant →
`templateFolder` from the existing `xml/config.xml`. It reads a
**bounded public-only** model from the Demo service on **8081** using a
loopback-only token-gated bridge. The Demo service uses its existing
`PortalTenantDataSourceRegistry`, so only the approved tenant's
PostgreSQL datasource is queried. The 8083 process never sees DB
credentials.

Bridge endpoints:
- Demo internal: `GET http://127.0.0.1:8081/sapi/internal/portal-public/{tenantId}?lang=vi`
- Request header: `X-Portal-Bridge-Token: <secret>`
- HTTP 503 if the token is not configured in Demo.
- HTTP 404 for a wrong token or non-loopback remote client.
- HTTP 400 for an invalid tenant id; an unknown tenant must not fall
  back to a default database.

The content bridge is disabled unless a token of >=32 characters is
provided in **both** processes. When disabled, the 8083 homepage
still uses placeholder values for compatibility tests. When enabled,
a Demo-side failure becomes HTTP 502 on 8083; there is no silent
fallback to empty content.

## Operator setup (never commit secrets)

Generate one random secret and store it in a file outside Git, mode 0600.
Configure the SAME value in both existing process launch environments:

- Demo 8081: `DEMO_PORTAL_BRIDGE_TOKEN=<same-secret>`
- Portal Web 8083: `PORTAL_WEB_BRIDGE_TOKEN=<same-secret>`

Use systemd `EnvironmentFile=` for systemd-managed processes, or the
existing environment/launch scripts if manually managed. Do not write
the token into URLs, command-line arguments, Git or access logs.
Keep the Demo `PORTAL_TENANT_CONFIG_DIRS` correctly set to its
existing tenant-property directory. If the Demo process cannot read
the tenant datasource properties, public content will fail.

The default `PORTAL_WEB_BRIDGE_URL` is
`http://127.0.0.1:8081/sapi/internal/portal-public`; it may only use
the localhost port 8081 in the current implementation.

## Build/check, one service at a time

On EC2, in the already existing feature-branch working tree:

```bash
cd /opt/tuonghoa/demo-split-test
git fetch origin
git status --short
git pull --ff-only origin feature/portal-web-and-qr-service-split

# Test/build the new renderer WITHOUT affecting production.
cd portal-web
mvn clean package

# Build Demo without automatically restarting port 8081.
cd ..
mvn -DskipTests=false clean package
```

Check whether the Demo root build requires specific profiles or modules
already used by your existing 8081 deployment, and preserve its
previous JAR before replacing any running process. A build alone does
not change the services in memory.

Configure and restart **Demo 8081 first**, verify its private bridge,
then restart **Portal Web 8083** using the newly built JAR. Never use
`pkill java`; identify the exact service/PID and launch options.

Verification:

```bash
# Health (no token)
curl -fsS http://127.0.0.1:8083/healthz

# Without a token the private endpoint must NOT give content:
curl -sS -o /dev/null -w '%{http_code}\n' \
  http://127.0.0.1:8081/sapi/internal/portal-public/nncminhchau.vn

# Invoke with the secret as an environment variable, not in a URL:
curl -sS -H "X-Portal-Bridge-Token: $DEMO_PORTAL_BRIDGE_TOKEN" \
  'http://127.0.0.1:8081/sapi/internal/portal-public/nncminhchau.vn?lang=vi' \
  | python3 -c 'import json,sys; m=json.load(sys.stdin); print("tenant",m["tenantId"],"articles",len(m["articles"]),"products",len(m["products"]),"menus",len(m["projectMenuEntities"]))'

for domain in anhmedia.vn nncminhchau.vn tuonghoa-imex.com; do
    curl -sS -o /dev/null -w "$domain: %{http_code} %{size_download} bytes\n" \
      -H "Host: $domain" http://127.0.0.1:8083/
done
```

## What is NOT migrated yet

- Product search, group/category pagination and filtering, related
  products, product-detail price/color/size/gallery selection.
- Dynamic `/article/{link}`, `/product/{path}` and arbitrary nested
  menu-driven page routes.
- Cart, order checkout, authentication, user-specific content, and
  any Vaadin admin pages. Keep those routes on the old 8080 service.
- Original article thumbnail/image-controller routes may still need
  the legacy 8080 image endpoint or a separate object-store service.
- Snapshot filtering/order is bounded and may not exactly reproduce
  the old `GreetingController` for very large tenant catalogs.
- Some tenants may lack optional historical tables. The bridge returns
  empty lists only for missing optional tables, not for unknown tenants.

Do not switch all public traffic to 8083 until at least two tenants
pass real content, SEO, CSS/JS, menu links and route-parity checks. Do
not stop 8080 yet.
