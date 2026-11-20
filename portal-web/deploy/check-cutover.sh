#!/usr/bin/env bash
# Read-only health and static-route checks before retiring old Portal 8080.
set -Eeuo pipefail

web_port="${PORTAL_WEB_PORT:-8083}"
demo_port="${DEMO_API_PORT:-8081}"
static_root="${BOM_STATIC_ROOT:-/var/www/html/bom-inventory}"
public_host="${PORTAL_CANARY_HOST:-anhmedia.vn}"

echo "[1] Process listeners (8080=legacy, 8081=demo, 8082=buffer, 8083=portal-web)"
ss -lntp 2>/dev/null | grep -E ':(8080|8081|8082|8083)[[:space:]]' || true

echo "[2] Portal-Web /healthz"
curl --fail --silent --show-error --max-time 8 \
  "http://127.0.0.1:${web_port}/healthz"
printf '\n'

echo "[3] Standalone tenant HTML response"
status=$(curl --silent --show-error -o /dev/null --max-time 15 \
  -w '%{http_code}' -H "Host: ${public_host}" \
  "http://127.0.0.1:${web_port}/")
echo "${public_host} homepage: HTTP ${status}"
test "${status}" = 200 || {
    echo "FAILED: standalone tenant homepage is not HTTP 200" >&2
    exit 1
}

echo "[4] Static deployment files"
for file in "${static_root}/index.html" "${static_root}/customer.html"; do
    test -s "$file" || {
        echo "FAILED: missing $file" >&2
        exit 1
    }
    echo "OK: $file"
done

asset_count=$(find "${static_root}/customer-assets/assets" \
    -maxdepth 1 -type f 2>/dev/null | wc -l)
echo "Customer assets found: ${asset_count}"
test "${asset_count}" -gt 0 || {
    echo "FAILED: QR customer build assets missing" >&2
    exit 1
}

echo "[5] Demo API TCP reachability"
if (echo > "/dev/tcp/127.0.0.1/${demo_port}") 2>/dev/null; then
    echo "Demo API port ${demo_port} reachable"
else
    echo "FAILED: Demo API port ${demo_port} unreachable" >&2
    exit 1
fi

echo "Read-only prerequisites PASSED."
echo "IMPORTANT: This does NOT prove dynamic product/article/cart parity or"
echo "OAuth/tariff/admin migration. Do NOT stop legacy Portal based on this check."
