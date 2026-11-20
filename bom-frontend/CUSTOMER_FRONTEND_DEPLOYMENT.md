# Customer-only QR Shop frontend

This is a separate **static** build of the existing public QR ordering React pages.
It is intentionally on a feature branch and is not currently deployed.

## Build

```bash
cd /opt/tuonghoa/demo/bom-frontend
npm ci
npm run build:customer
# build output: dist-customer/customer.html and dist-customer/assets/*
```

The main/admin build remains `npm run build`. The customer build only imports public
`/shop/*` routes and retains the original `BrowserRouter basename="/bom-inventory"`.
Existing printed QR code links such as `/bom-inventory/shop/menu?t=...` therefore do not change.

## Deployment approach (illustrative; DO NOT change production Nginx blindly)

Copy `dist-customer/` to an independent static directory such as
`/var/www/html/bom-customer/`. In the **correct HTTPS server block**, add
the following before the general `/bom-inventory/` SPA handler:

```nginx
# Customer bundle assets; never routed to the admin React bundle.
location ^~ /bom-inventory/customer-assets/ {
    alias /var/www/html/bom-customer/;
    try_files $uri =404;
}

# Original QR URLs remain unchanged; serve a separate customer-only HTML shell.
location ^~ /bom-inventory/shop/ {
    # For all public QR routes, return the customer SPA entrypoint.
    try_files /__unused__ /bom-inventory/customer-assets/customer.html;
}
```

Note: Test the Nginx `try_files` internal redirect in your real site config;
`alias`, `root` and legacy SPA `location` precedence can differ. Do not
replace working routes until `nginx -t` and end-to-end QR tests pass.

Keep the existing API routing:
- `/sapi/shop/public/orders` POST and `/sapi/order-buffer/**` -> order-buffer port 8082.
- Cached public menu/token endpoints may use 8082.
- Remaining `/sapi/**` endpoints -> Demo port 8081 while order domain remains there.

Redis and the existing order-buffer service protect queued orders **during Demo restarts**,
but some dynamic checkout/status features still need Demo; this is not full API isolation.
Do not claim complete independence until the order domain has been extracted.
