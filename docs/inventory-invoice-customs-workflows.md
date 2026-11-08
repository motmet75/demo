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