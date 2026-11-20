# NNC Minh Châu invoice and inventory handoff (2026-11-14)

`nncminhchau` is an active demo administrator assigned to tenant
`nncminhchau.vn` and its `NNCMINHCHAU` company in the `anhmedia` database.
The tenant already had 33 inventory lots when this work started.

The visible, approved legacy `nncminhchau` data has 20 `purchase_invoice` rows
(11 invoice numbers) and 267 `inventory_movement` rows (189 IN, 78 OUT). The
import preserves them in `nnc_legacy_purchase_line` and
`nnc_legacy_inventory_movement`, linked to demo material and inventory IDs.
All imported values use VND. The original portal row is retained in
`source_row`.

The tenant's prior demo stock was backed up and replaced with 16 fresh lots and
267 native `inventory_movement` rows using `db/nnc_native_inventory_rebuild.sql`.
Native IN is positive and OUT is negative. The ledger and on-hand lots both
total 111 units. The posting user is `nncminhchau`, scoped to its company.
Previous demo stock postings (44 movements, three PDF receipts, two customs
declarations and one invoice stock-out) were removed. Original business
invoices and Invoice Desk PDFs remain. The verified full server backup is
`/home/admin/backups/anhmedia-before-nnc-native-reset-20261114.dump`; the local backup is
`tmp/db-restore/anhmedia-local-before-nnc-native-reset-20261114.dump` (ignored by Git).

Eight `C26TYY` purchase lines have matching original PDFs in Invoice Desk.
Their VND line subtotals plus 8% VAT equal the PDF totals. The PDF dates are
August 7 or 8, 2026, while the portal source dates are September 8, 2026.
`db/nnc_pdf_reconcile.sql` links those lines to their PDFs and uses the PDF
date as `invoice_date`. The other 12 lines retain portal dates until source
PDFs can be reviewed. Their original values remain in `source_row`.

In Inventory → Hóa đơn xuất, the left column lists VIN Portal and locally
created VIN-HOADON selling invoices; the right column lists available inventory
lots. Drag a lot onto a line or use the lot picker, check quantities and amounts,
then confirm. A local VIN-HOADON invoice must be `ISSUED`. The server blocks a
second deduction by invoice serial/number, the portal invoice ID, or a linked
shop order that already posted OUT. Existing Invoice Desk PDF stock-out remains.

The website account for tax ID `0317544489` listed 103 invoices in 2026 on
November 14. There are 57 signed, tax-accepted originals or replacements.
Thirty-two of those have exact links to approved portal OUT movements in
`vin_portal_legacy_out_link`, including the July 8 Yanmar invoice whose portal
OUT note says `26-M023` but whose VIN invoice number is 26. Three older
invoices (`1C26MMC` 23, 25 and 33) have no matching OUT; the 22 newer invoices
also have no OUT. Therefore 25 invoices are available for stock review, not
just invoices whose numbers exceed a cutoff. Drafts, tax-rejected invoices,
replaced originals and adjustments are excluded. All amounts are VND.

The eight visible C26TYY purchase lines total 120 units, all represented by
native IN movements. Twelve native OUT units already reduced their eight
mapped lots to 108 on hand. Three units remain in older lots, giving the total
NNC stock of 111. The 25 pending VIN invoices have not been posted to OUT:
their engine serials do not identify which broad mixed purchase lot to debit,
and two NISSAN sales have no NISSAN-labelled lot.

Receipt-cost correction: C26TYY 015 (15 units at 8,000,000 VND each) and
C26TYY 019 (17 units at 6,000,000 VND each) had been merged into a 32-unit
inventory lot using the latter price. `db/nnc_receipt_lot_price_quantity_fix.sql`
split the receipts into separate lots and reassigned their native IN movements.
`db/nnc_receipt_price_alignment.sql` aligned all eight C26TYY lot prices to
their portal purchase lines. `inventory.quantity_total` and
`warehouse_import_quantity` now show each native lot's original gross IN
quantity; `quantity_on_hand` is the remaining balance. There are now 17 NNC
lots, with 189 original units and 111 on hand. The pre-fix full server backup
is `/home/admin/backups/anhmedia-before-nnc-receipt-split-20261114.dump`.
The local backup is `tmp/db-restore/anhmedia-before-nnc-receipt-split-20261114.dump`
(ignored by Git, owner-only access).

The server cannot connect to the VIN website. From this local network, run
`./bin/sync-nnc-vin-portal.sh` to refresh both databases. It prompts for the
VIN website password and does not save it or the bearer token. The command
refreshes existing invoice statuses so newly rejected or replaced invoices
stop appearing. It checks all signed invoices from 2026 onward, pulls all
pages, and retains the linked legacy OUT exclusions.

The server's NNC account has 16 local VIN-HOADON invoice records: 6 DRAFT,
9 RECONCILE, 1 FAILED, and none ISSUED. The earlier shop stock postings were
removed by the requested reset. Reconcile or issue invoices before using this
flow; it requires `ISSUED` and checks the live ledger for duplicate deductions.

Schema files: `V20261114__vin_invoice_stock_out_source.sql`,
`V20261114_2__nnc_legacy_inventory_history.sql`, and
`V20261114_3__vin_portal_stock_out.sql`, and
`V20261114_4__vin_portal_legacy_out_link.sql`. The sync command deletes its temporary
source export and generated SQL after updating both databases.

The local `anhmedia` schema was synchronized with the server's public schema:
211 tables, all server indexes, and equivalent external VIN invoice uniqueness.
Six case-only duplicate materials were merged locally so the server's unique
material-code index could be added. The focused stock-out and VIN tests pass.
