# GDT OCR and usage controls

The desktop pairing code creates the only customer token required by the GDT client. The resulting short-lived desktop session authorizes online OCR, usage reads, failure telemetry, login protection, and invoice/report reservations. Google credentials never leave the Demo backend.

## Super-admin API

All endpoints require `ROLE_SUPER_ADMIN`.

- `GET /admin/gdt-control/defaults`
- `PUT /admin/gdt-control/defaults`
- `GET /admin/gdt-control/tenants/{tenantId}`
- `PUT /admin/gdt-control/tenants/{tenantId}`
- `GET /admin/gdt-control/events?tenantId={tenantId}&limit=200`

Defaults include trial days, OCR monthly/daily limits, device limit, telemetry retention, and invoice quota mode.

`invoiceQuotaMode` accepts:

- `INVOICE`: count newly downloaded unique invoice identities. Failed downloads release their reservation.
- `RUN`: count one completed report download run, regardless of how many invoice PDF/ZIP artifacts it contains. `monthlyRunLimit: 3` gives three runs per calendar month. A run with no successfully downloaded artifacts is released.

Example default policy body:

```json
{
  "trialDays": 30,
  "invoiceQuotaMode": "RUN",
  "monthlyRunLimit": 3,
  "monthlyInvoiceLimit": 100,
  "monthlyOcrLimit": 50,
  "dailyOcrLimit": 20,
  "maxInvoicesPerJob": 100,
  "maxDevices": 2,
  "localOcrEnabled": true,
  "onlineOcrEnabled": true,
  "telemetryRetentionDays": 90
}
```

`maxInvoicesPerJob` applies only to `INVOICE` mode. `RUN` mode intentionally allows unlimited invoice artifacts inside an allowed report run.

## Privacy and anti-abuse

- Five consecutive GDT authentication rejections block that tenant/account hash for ten minutes.
- Network, OCR, and GDT server failures do not increment the login block counter.
- Failure events contain sanitized stage/category metadata, never passwords, CAPTCHA answers/images, cookies, portal bearer tokens, pairing tokens, or desktop tokens.
- Online OCR is limited by both daily and monthly counters.
- Device limits count distinct active desktop client nonces.
- Event retention follows the super-admin default.
