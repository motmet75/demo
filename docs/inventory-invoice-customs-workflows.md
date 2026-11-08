# BOM Inventory: Purchase PDF and Customs Declaration

## Reused code
Portal master: src/main/java/Utilities/CDSExcelImporter.java and CdsItem.java.
Demo parser reads .xls/.xlsx using Apache POI WorkbookFactory, <IMP> item markers, and Vietnamese labels. It does not copy Vaadin/JPA classes.

## Existing inventory receive modal
- Hóa đơn mới · Nhập kho: manual entry remains.
- Upload/select an existing Invoice Desk PDF; review original supplier item name beside the internal material code/name.
- Select an existing material or define a new one directly on the same row; in PDF mode material creation and inventory posting happen in one transaction.
- Price, quantity and VAT are shown in Vietnamese numerical format. Corrections to OCR must be made in Invoice Desk before posting.
- Ledger stores document UUID, supplier, original item description, original material name, batch, cost and tax. Upload alone changes no inventory.

## Customs workflow
- Inventory: Nhập kho · Tờ khai HQ and Xuất kho · Tờ khai HQ.
- Upload/select .xls/.xlsx customs declaration and review HS, source item name, quantity, unit, declared price and origin.
- IN: map to material/warehouse/batch, create new material within the dialog if needed.
- OUT: map each declaration line to an actual inventoryId/warehouse/batch; stock-level row locks, aggregate availability checks and unique declaration posting prevent double-deduction.
- Customs movements use referenceType CUSTOMS_DECLARATION.
- Customs declaration prices are audit values ONLY; they do not overwrite purchase/landed inventory costs.

## Required additive migrations
1. src/main/resources/db/migration/V20261108_2__inventory_invoice_pdf_receipt.sql
2. src/main/resources/db/migration/V20261108_3__customs_declaration_inventory.sql

## Verification
Run ./mvnw -Dtest=CustomsDeclarationExcelParserTest test and ./mvnw -DskipTests compile,
then cd bom-frontend && npm run build.
Apply migrations before bringing the new backend into service.
Restart Demo using ./bin/demo-live.sh restart to retain Google Vision OCR.
Deploy frontend to /var/www/html/bom-inventory using ./bin/bom-frontend-live.sh restart.

## Limits
- Customs importer supports the Portal-style Excel export, not customs declaration PDFs.
- It reads the first worksheet with <IMP> markers. Other customs templates require a separate parser profile.
- Users must confirm direction, declaration date, stock conversion and receipt/issue independently of the Excel data.
- Historical documents change current on-hand balances at confirmation; historical opening balances are not rebuilt.

## Multi-document review and VAT (November 2026)
- Existing **Hóa đơn mới · Nhập kho** modal: choose up to 30 supplier PDFs/images at once.
  Upload adds documents to a local review queue; each document is selected,
  mapped to internal materials, confirmed and posted separately, not merged
  into one invoice. Existing stored Invoice Desk documents can also be queued.
- Material selector uses a compact **+** button beside the material input.
  Hover displays "Tạo nguyên vật liệu mới tại dòng này". New material fields
  remain inline in the same row.
- VAT can be edited per item or across the entire invoice using VAT chung (%).
  Manual invoice subtotal, taxAmount and totalAmount are saved, and payment
  is based on the gross total after VAT. PDF reconciliation still requires
  explicit acceptance if calculated totals differ from the source PDF.
- Customs declaration modal accepts up to 30 Excel files per upload, queues
  them for independent verification and inventory posting. Each declaration
  keeps its own direction, date, warehouse/batch and material mapping.
- Customs VAT is **not** inferred from "Thuế suất" (which may refer to
  import duties). Its editable percentage is recorded separately for audit.
  The customs line value, VAT and after-VAT gross are informative; when a
  customs line lacks a declared price the consolidated totals are NULL.
- Additional additive SQL migration:
  src/main/resources/db/migration/V20261108_4__customs_declaration_vat_audit.sql

## Automatic material-code generation and invoice FK correction
- In Hóa đơn mới · Nhập kho and Nhập kho · Tờ khai HQ, Tạo mới defaults the editable material name to the invoice/declaration original item name.
- Tự sinh mã is enabled by default. UI generates MAT- plus 20 uppercase hex characters, avoiding codes loaded from the tenant/company and codes of other draft rows. Toggle it off to enter a manual code.
- Backend validates all codes case-insensitively per tenant/company and generates unique ones when blank. The database unique index protects simultaneous requests.
- Additive migration: src/main/resources/db/migration/V20261108_5__material_code_unique_ci.sql. Before running it check for existing duplicate codes by tenant/company ignoring case:
  SELECT tenant_id, company_id, upper(btrim(material_code)) code, count(*) FROM public.material GROUP BY 1,2,3 HAVING count(*)>1;
  If this query returns rows, resolve those duplicate legacy codes first; do not delete stock data.
- InvoiceService.create() uses JPA saveAndFlush(), making public.invoice visible before the JDBC INSERT of inventory_invoice_pdf_receipt referencing its id.
- InvoicePdfReceivingService also verifies the invoice row is visible to scoped JDBC, aborting the transaction with a clear error if JPA/JDBC schemas or datasource routing differ.
- Before deployment run ./mvnw -Dtest=MaterialServiceGenerationTest,InvoiceServiceFlushTest test and node --test bom-frontend/tests/materialCode.test.mjs, then npm run build in bom-frontend.
- Frontend-only deployment does not resolve the invoice foreign-key issue: build and deploy the updated Demo JAR as well.
