# Invoice Desk

The invoice extraction engine from `L:\invoiceToExcel` is integrated into this Spring Boot project. The browser interface is served at `/invoice-desk/` (or `/sapi/invoice-desk/` when the application uses the existing `/sapi` context path). The BOM navigation includes an Invoice Desk link.

## Start

For localhost, configure the database in the secrets file below, then run `./start-local.ps1`. The `local` profile binds to `127.0.0.1:8080`, uses servlet sessions instead of Redis sessions, and disables Google OAuth for the local preview. Open `http://localhost:8080/invoice-desk/`. Logs are under `tmp/local-app/`. Production defaults remain unchanged.

Use the demo's normal PostgreSQL, Redis/session, and OAuth configuration. Supply database connection properties in the ignored `secrets/application-secrets.properties`:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/YOUR_DATABASE
spring.datasource.username=YOUR_DATABASE_USER
spring.datasource.password=YOUR_DATABASE_PASSWORD
```

The existing demo schema must already be installed. The Invoice Desk startup initializer creates its four module tables from `src/main/resources/db/schema/invoice_desk.sql` and, only when `invoice-desk.bootstrap-password` is explicitly configured, provisions one Anthony tenant, one Anthony company, and the `anthony` login. No default password is embedded. Existing accounts and passwords are never overwritten. If an existing Anthony account needs access, explicitly map its assigned tenant/company into `invoice_desk_company`; the initializer will not claim an existing account.

Run the normal application, or build the executable jar:

```powershell
.\mvnw.cmd package '-Dmaven.test.skip=true'
java -jar target/demo-0.0.1-SNAPSHOT.jar
```

`invoice-desk.bootstrap-password` is required to opt into creating the initial account. It has no effect on an existing account. This feature does not populate a real company tax ID or real user email; update the placeholder account profile separately.

## Workflow

1. Sign in and upload PDFs/images (25 MB per file, PDF engine limit 100 pages). Text PDFs extract offline. Source bytes and extracted evidence are stored in PostgreSQL.
2. Download the original and review editable header fields and line items. Save a draft, or approve after resolving missing fields, OCR failures, and arithmetic warnings.
3. Add supplier configuration by 10- or 13-digit tax ID. Spaces/hyphens normalize away. Store layout observations in empirical notes; add field capture patterns, fixed values, and required-field checks. Patterns use RE2 syntax and capture group 1. They cannot change the tax ID used to select the supplier. Manual edits are preserved until the user explicitly applies rules again.
4. Approving creates an append-only SQL learning example with previous values, corrected labels, table evidence, source text/hash, reviewer, and time. Re-uploading identical source bytes returns the existing corrected document. Examples are not automatic model training; rules generalize supplier layouts to new documents. Learning history displays the latest 200 approvals.
5. Export draft Excel for review or approved Excel for delivery. Invoices, line items, appendices, appendix items, and review logs remain separate sheets. Production export checks duplicate identities and appendix reconciliation.

Scope comes from the authenticated account's current database assignments, not browser tenant headers. One company mapping per tenant is enforced by SQL keys. Source downloads, rules, history, updates, and exports use that scope. Concurrent document edits return HTTP 409. Module mutations require the custom same-origin request header used by the GUI.

## OCR and storage

Default `invoice-desk.ocr=off` makes no external OCR calls. For local OCR install Tesseract with `vie` and `eng` language packs and configure:

```properties
invoice-desk.ocr=tesseract
invoice-desk.tesseract-path=C:/Program Files/Tesseract-OCR/tesseract.exe
```

The web module supports offline PDF extraction, Tesseract and Google Vision. Configure `invoice-desk.ocr=google` and `invoice-desk.google-credentials` with an absolute server path to a Google service-account JSON file. `GOOGLE_APPLICATION_CREDENTIALS` is also supported. Google Vision sends invoice images to Google Cloud and requires API access/quota. Selecting Google on the server authorizes these calls; the desktop access-code prompt is not used. The OCR settings tab reports the selected provider without disclosing the credential path or contents. Re-run OCR processes a stored draft with optimistic version checking; successful extraction replaces its fields and items, while an empty/error result preserves the existing draft. Approved invoices must first be saved as drafts. Desktop GUI, credential bundles, private source invoices, and desktop learning files are not copied. SQL storage replaces desktop correction/training files. Per-import temporary files are removed after processing. Database backups must include the new tables, which contain original documents and review data.

## Verification

```powershell
$env:INVOICE_TEST_JDBC_URL='jdbc:postgresql://127.0.0.1:55432/postgres'
$env:INVOICE_TEST_DB_USER='invoice_test'
# Set INVOICE_TEST_DB_PASSWORD if required.
.\mvnw.cmd test -Pinvoice-desk-tests '-Dtest=SupplierRulesTest,InvoiceDeskDatabaseTest,InvoiceEngineTest,BorderTableTest'
node --check src/main/resources/static/invoice-desk/desk.js
```

Database tests create and remove a uniquely named schema. Use an expendable PostgreSQL database; its user needs CREATE SCHEMA. Without the URL, database tests skip. Tests cover real PDF import, source retention, company isolation, supplier application, optimistic concurrency, approval history, Excel output, table borders/wrapped rows, and material codes. The focused profile runs the invoice module tests; the full test suite also compiles with the current controller Authentication parameter.

Provenance: core Java classes and default seller profiles were copied from the requested source project, with Java 17 list-access adaptations and a server-mode Settings constructor. The engine/parser behavior is retained; the Spring service and browser UI are new.

## Server paths and local testing

Debit notes with logistics charge rows are recognized as `DEBIT_NOTE` and exported on separate `Debit notes` and `Debit items` sheets. The default phrase rules in `src/main/resources/invoice-phrase-rules.json` expand `VC CL` before `VC`, using whole-phrase boundaries. Set `invoice-desk.phrase-rules` to an absolute JSON path to replace these defaults; each entry has `from` and `to` strings. Restart after changing server properties. Rules apply during extraction; they do not overwrite manual edits during save. Original descriptions and notes are retained. Truck plates are extracted into `truckPlate` (displayed as `Biển số xe`), without interpreting container identifiers as plates. Missing tax IDs and invoice serials are not invented for debit notes.

The local `Debit Note KL 1126 KT.pdf` import is a draft under tenant `khanh-linh`; its 26 lines, 18 truck-plate rows, and VND 101,844,000 total were verified against the source. Account assignment remains explicit through administration; importing does not reassign an existing user.

Put instance-specific settings in the ignored `secrets/application-secrets.properties`; restart the backend after changes. Do not put credentials in browser assets or commit them. Forward slashes work for Windows properties paths. Example:

```properties
invoice-desk.ocr=google
invoice-desk.google-credentials=C:/secure/google-vision-service-account.json
# Linux alternative: /etc/anhmedia/google-vision.json
```

OCR credentials are separate from HTTPS certificates. For direct Spring HTTPS, the same external properties file can override:

```properties
server.ssl.enabled=true
server.ssl.key-store=file:/etc/anhmedia/tls/server.p12
# Windows: file:C:/secure/server.p12
server.ssl.key-store-type=PKCS12
server.ssl.key-store-password=YOUR_KEYSTORE_PASSWORD
server.ssl.key-alias=YOUR_KEY_ALIAS
```

When Nginx terminates HTTPS, configure its certificate there and retain the backend protocol expected by its proxy. No Nginx settings are changed by this feature. Local HTTP testing continues on port 8081. Local TLS can also use `LOCAL_HTTPS_ENABLED`, `LOCAL_TLS_KEY_STORE` (a file URI), `LOCAL_TLS_KEY_STORE_TYPE`, `LOCAL_TLS_KEY_STORE_PASSWORD`, and `LOCAL_TLS_KEY_ALIAS`.

Server OCR caches use the private per-import temporary directory and are deleted after each import; they do not require a desktop vault password. Persistent source documents and extracted data remain in PostgreSQL. A Windows DPAPI-protected credential must be unlocked on its originating Windows account and installed as a service-account JSON on Linux, readable only by the application service account.
