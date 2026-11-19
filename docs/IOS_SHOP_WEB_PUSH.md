# AnhMedia iPhone QR Shop — Web Push

Private staff push alerts via installed Home Screen PWA, no App Store publication or Apple Developer membership.

## Enable on iPhone 11 / iPhone 16

1. On iOS 16.4+ open https://anhmedia.vn/bom-inventory/shop-orders in Safari and sign in.
2. Safari Share → Add to Home Screen. Launch AnhMedia using Home Screen icon.
3. Select authorized tenant and company.
4. Tap Bật thông báo → Allow. Tap Gửi thử to check delivery.
5. Create a new QR order, then check the iPhone lock screen.

## Configure backend

Generate VAPID keys on a trusted computer: npx web-push generate-vapid-keys
Set APP_WEB_PUSH_PUBLIC_KEY, APP_WEB_PUSH_PRIVATE_KEY and APP_WEB_PUSH_SUBJECT=mailto:services@anhmedia.vn in the protected backend environment.
Never commit the private key. Keep it stable across deployments or devices must re-subscribe.
Deploy SQL migration V20261118_1__shop_web_push_subscription.sql before enabling backend delivery.
Serve Vite build under /bom-inventory/ with HTTPS and working /sapi proxy. Allow server outbound HTTPS to web.push.apple.com:443.

## Backend paths

- GET /sapi/shop/staff/push/public-key
- POST /sapi/shop/staff/push/subscriptions
- DELETE /sapi/shop/staff/push/subscriptions
- POST /sapi/shop/staff/push/test

All require authenticated staff role (existing /shop/staff/** Spring Security rule). Subscription methods validate authenticated user's tenant/company assignment and supplied X-Tenant-Id / X-Company-Id.
Order event: ShopOrderService.createOrder() after a new pending order is stored; an afterCommit callback schedules push. Confirmation email behavior remains unchanged.
Lock screen content has order identifier and table label only, not customer name/phone or token.

## Checks before merging

- Run mvn -DskipTests compile and mvn -Dtest=ShopWebPushServiceTest test from root.
- Run npm ci && npm run build in bom-frontend.
- Test iPhone Home Screen installation, opt-in, test push, pending order and no duplicate upon confirmation.
- Verify another company's account cannot register for this company's alerts.
- Verify existing email notifications and staff order-grid polling still work.

## Limits

Push is best-effort; offline/Focus/low power conditions can delay it. Keep polling as fallback.
Server currently uses a bounded in-memory executor, not durable retries. User opt-in is mandatory.
Expo Go is not involved in this Web Push mechanism.
Not production deployed or device-tested by this PR.
