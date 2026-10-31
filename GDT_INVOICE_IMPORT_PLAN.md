# GDT bulk invoice retrieval — implementation preparation

Prepared 2026-10-29. Scope: retrieve the signed-in taxpayer's purchase invoices
(mua vao / INPUT) and sales invoices (ban ra / OUTPUT) into Invoice Desk.
This is a design and discovery record; the connector is not implemented or authenticated yet.

## Evidence and open questions

- `C:\Users\Anh\Downloads\thueHoaDonFilter.mht` was inspected. It is a
  saved HTML view of the portal's sales-invoice search page, not a PDF download
  response. It contains one rendered result for `0317544489` (symbol `C26TMC`,
  number `8`, issue date `26/10/2026`, total `18,750,000 VND`) and no embedded
  invoice PDF/XML or direct download URL. It confirms the portal UI labels and
  columns but cannot reveal a private download request by itself.
- The portal's public frontend maps the list's “view invoice” action to
  `GET /api/query/invoices/detail` with `nbmst`, `khmshdon`, `khhdon` and `shdon`
  query parameters. The list export actions map to
  `/api/query/invoices/export-excel` and `/api/query/invoices/export-excel-sold`.
  The saved MHT does not show a PDF route; PDF may be generated client-side from
  the detail response or require another authenticated request captured while
  opening the invoice.
- The print icon does not call a PDF API. The public bundle's `printInvoice`
  handler opens a new window, fetches detail data first, renders invoice template
  functions (`HD_01` and related templates) into HTML, then calls
  `window.print()`. The browser's print dialog is what creates a PDF. This means
  bulk PDF support should fetch each detail record and render the same template
  in a controlled browser, or provide a clearly labelled local report PDF; it
  must not claim to download an original PDF that the portal never provides.
- The portal's official original-data action is a ZIP/XML export: the bundle
  calls `GET /api/query/invoices/export-xml` with `nbmst`, `khmshdon`, `khhdon`
  and `shdon` parameters. The localhost proxy now exposes this as its scoped
  `/api/xml` action for one selected invoice.

- The public portal at https://hoadondientu.gdt.gov.vn/ returned HTTP 200 from
  this workstation. Headers included `X-Frame-Options: DENY`; do not embed its
  login page in the existing Invoice Desk iframe.
- Public HTML identifies a Next.js application. The public build manifest
  includes `/tra-cuu/tra-cuu-hoa-don`. Build identifiers and chunk names are
  deployment-specific and must not become application configuration.
- Public state has authentication fields including `jwt`, `user`, `authorities`
  and `mst`. This does NOT establish the authenticated request contract or prove
  that copying a JWT alone is sufficient.
- The public `_app` JavaScript references `/api/captcha` and parameterized
  `/api/{service}/invoices/purchase`, `/sold`, `/export-excel` and
  `/export-excel-sold` paths. Its list code uses `sort=tdlap:desc`, `size`
  (default 15), `state` and `search`, and references `datas`, `total` and `state`
  response fields. Request helpers can add Bearer authorization. These are
  source-code observations only: service selection, cursor semantics, CAPTCHA
  placement and actual account access must be verified after login. Do not
  hardcode these as a stable supported API or assume page-number pagination.
- No account was used, no CAPTCHA was submitted and no private invoices were
  accessed. Working endpoint contracts, request bodies, pagination, date limits, category
  coverage, download formats and session lifetime remain unverified.
- Historical tax-office guide: https://www.binhthanhtax.gov.vn/wp-content/uploads/2023/01/HDDT_HDSD_NNT_MTT.pdf
  Search indexing describes purchase/sales tabs, filters and pagination, but
  direct retrieval failed. Treat this as a discovery lead, not current API documentation.
- Browser session reuse reference: https://playwright.dev/java/docs/auth
  Playwright supports isolated contexts and authenticated-state reuse; session
  storage requires separate handling. Prefer continuing the original context.

## Recommended login workflow

1. User chooses company, INPUT / OUTPUT / BOTH, issue-date range and desired
   artifacts in Invoice Desk, then selects Connect to tax portal.
2. A local Java Playwright worker opens a dedicated visible browser context.
   Manual login is the first implementation: user enters username, password and
   CAPTCHA directly on the portal. Never request a password in chat.
3. An optional assisted mode fills username/password supplied through a secure
   local prompt; the user still enters CAPTCHA. Keep the password transient,
   exclude it from logs and do not retry a failed password automatically.
4. After Continue, validate an authenticated read-only page and the taxpayer
   identity/permissions. A clicked Continue button or missing login dialog alone
   is not proof of login. Bind the verified tax identity to the authorized company.
5. Keep that same browser context for retrieval. Pause for manual re-login on
   expiry or a new challenge; resume from a durable checkpoint afterwards.
6. Disconnect closes the context and clears transient credentials/session data.

An arbitrary browser tab that was already logged in cannot automatically be
read by our web app. Manual login must occur in the worker-controlled browser,
or a separately designed browser extension/local companion must provide the
handoff. Do not ask users to paste cookies or bearer tokens.

For a remote Spring server, opening a browser on the server does not display it
on the user's desktop. Recommended deployment is a local companion retaining
the portal session and uploading invoice results to Spring over authenticated
HTTPS. Pair it using short-lived, one-use credentials bound to user/company/job;
do not expose browser debugging ports or reuse the user's normal browser profile.
The first proof can run entirely on this Windows workstation.

## Existing project integration

| Existing component | Reuse or required change |
|---|---|
| `InvoiceDeskService.scope(Authentication)` | Reuse server-derived user/company/tenant scope; never accept tenant authority from request bodies. Add a verified portal taxpayer binding. |
| `InvoiceDeskController` | Add scoped connection/job endpoints under `/api/invoice-desk/gdt`; follow existing mutation-header/access controls. |
| `InvoiceDeskTasks` | Existing tasks run on HTTP threads in memory. Create a separate durable worker queue for bulk retrieval. |
| `invoice_desk_document` | Reuse draft review and source retention; SHA-256 alone cannot identify the same invoice downloaded in different formats. |
| `InvoiceDeskService.upload` | Current engine path targets PDF/images. Add a structured import path for portal JSON/XML rather than pretending XML is an OCR file. |
| `static/invoice-desk/` | Add connection status, date/direction filters, job progress, retry/resume/cancel and import results here. |
| `bom-frontend/.../InvoiceDeskPage.jsx` | Existing wrapper embeds Invoice Desk; keep new controls in the actual desk UI. |

Keep portal status and local review approval separate. Synchronization must not
automatically approve invoices or overwrite user-corrected fields.

## Retrieval and storage design

- Split a requested date range into inclusive windows of at most 30 calendar
  days. The portal rejects longer query windows; bulk retrieval must advance by
  30-day windows and preserve Asia/Ho_Chi_Minh boundary semantics.
- Enumerate every verified category, direction and page. Discover whether
  ordinary and cash-register invoices use separate tabs or requests. Do not
  report completion when a category remains unsupported.
- Prefer normal browser interactions initially. Introduce a request adapter
  only after observing the portal's own authenticated read-only traffic and
  validating the request contract. Public frontend paths are not a supported API.
- Use one in-flight request per portal session initially, configurable pacing,
  bounded retries with jitter, and Retry-After when provided. Stop retries on
  authentication failures and repeated challenges; back off on rate limits.
- Persist an invoice and its artifacts before advancing its checkpoint.
  Repeating a page after a crash must be idempotent. Reconcile counts and unique
  identities; detect repeated cursors/pages and truncated results.
- Use a lease/heartbeat so only one worker claims a job. Persist cancellation,
  resume position, window/category/page progress and per-invoice failures.
- Save original bytes, media type, SHA-256, acquisition timestamp, source
  identity and raw status alongside normalized data. Record missing artifacts
  explicitly. Do not promise original XML/PDF until their availability is verified.
- Identity candidate: tenant + company + verified taxpayer + direction + seller
  tax ID + invoice model + symbol + number; confirm against real data. Store a
  portal ID separately when provided. Preserve number formatting and originals.
- Store replacement/adjustment links and status history without deleting the
  original invoice. Re-fetch overlapping windows to detect later status changes.
- Use BigDecimal for amounts, explicit currency, nullable missing fields and
  distinct issue-date vs retrieval-time fields. Retain line items when available.
- XML parsing must disable external entities/DTDs. Bound archive expansion,
  file size and entry counts; prevent path traversal. Sanitize filenames.
- Use paged database reads and streamed/chunked downloads and exports. The
  current all-document reads and byte-array export path need changes before
  they can support large datasets reliably. Neutralize spreadsheet formulas in
  untrusted text cells while retaining original source values.

Proposed tables (migrations to be written during implementation):

- `gdt_connection`: scoped owner, verified tax ID, worker reference, state/expiry;
  no plaintext password or token column.
- `gdt_sync_job`: scope, immutable filters, state, counters, checkpoints,
  lease/heartbeat, cancellation and timestamps.
- `gdt_sync_item`: job, external identity, state, retry information, document link;
  unique scoped identity prevents duplicate ingestion.
- `gdt_invoice_artifact`: scoped identity, format, source hash and private storage
  reference; reuse existing source storage where compatible.

Job states: WAITING_LOGIN -> READY -> RUNNING -> COMPLETED or PARTIAL_FAILED.
RUNNING may enter WAITING_LOGIN, PAUSED, FAILED or CANCELLED. Resume rechecks
ownership and portal identity before reclaiming work. COMPLETED requires all
selected windows/categories/pages accounted for and no unresolved item failures.

Proposed application endpoints (these are OUR APIs, not tax-portal endpoints):

| Method/path under `/api/invoice-desk/gdt` | Purpose |
|---|---|
| POST `/connections` | Create a scoped worker/login session |
| GET `/connections/{id}` | Read sanitized login/identity status |
| POST `/connections/{id}/continue` | Validate manual login |
| DELETE `/connections/{id}` | Disconnect and invalidate session |
| POST `/jobs` | Validate selection and enqueue retrieval; return 202 + job ID |
| GET `/jobs/{id}` | Progress, counts and sanitized failure summary |
| POST `/jobs/{id}/pause`, `/resume`, `/cancel` | Durable lifecycle control |
| GET `/jobs/{id}/items` | Paginated imported/failed items |

## Build sequence and verification

1. **Authenticated discovery:** open the controlled browser; user logs in.
   Inspect one purchase and one sales invoice, available categories, date
   validation, paging and each download action. Record sanitized schemas and
   selectors. Do not retain raw authenticated HAR files, tokens or screenshots
   containing credentials. Confirm a known result count against the UI.
2. **Small vertical slice:** manual login -> one bounded date window -> both
   directions -> source retention -> draft review -> Excel. Confirm totals and
   line items against the portal and prove importing twice creates no duplicates.
3. **Bulk reliability:** implement durable queue, leases, bounded downloads,
   checkpoints, retries, cancellation, category coverage and partial-failure UI.
4. **Production deployment:** add companion pairing, secure transport, session
   cleanup, per-company isolation and paged/streamed export.

Required checks: tenant isolation; wrong-taxpayer rejection; empty results;
multiple pages and categories; leap-day/month boundaries; changing result sets;
session expiry and manual re-login; 429/5xx handling; crash after item commit;
worker lease expiry; cancellation; duplicate formats; changed status without
overwriting corrections; malformed XML/ZIP; and an offline large synthetic
dataset (for example 10,000 invoices). Live acceptance uses a small authorized
sample, not a load test against the portal.

Next required input during implementation is a manual login in the controlled
browser and a small date range with known purchase/sales results. Credentials
are not needed to review this design. No production code or schema changed in
this preparation phase.
