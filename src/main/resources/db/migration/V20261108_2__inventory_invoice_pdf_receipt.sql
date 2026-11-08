-- OCR invoice -> inbound receipt. Additive: existing manual inventory receipts unchanged.
-- The source PDF and OCR revisions remain in Invoice Desk.
CREATE TABLE IF NOT EXISTS public.inventory_invoice_pdf_receipt (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    document_id uuid NOT NULL,
    purchase_invoice_id uuid NOT NULL REFERENCES public.invoice(id),
    invoice_serial varchar(80) NOT NULL,
    invoice_number varchar(80) NOT NULL,
    invoice_date date NOT NULL,
    supplier_name text NOT NULL,
    supplier_tax_id varchar(32),
    currency varchar(3) NOT NULL,
    pdf_sha256 varchar(64) NOT NULL,
    confirmed_by varchar(100) NOT NULL,
    confirmed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id,company_id,document_id),
    UNIQUE(tenant_id,company_id,invoice_serial,invoice_number),
    UNIQUE(purchase_invoice_id)
);
CREATE INDEX IF NOT EXISTS invoice_pdf_receipt_date_idx
 ON public.inventory_invoice_pdf_receipt(tenant_id,company_id,invoice_date DESC);
CREATE TABLE IF NOT EXISTS public.inventory_invoice_pdf_receipt_line (
    id uuid PRIMARY KEY,
    receipt_id uuid NOT NULL REFERENCES public.inventory_invoice_pdf_receipt(id),
    invoice_line_index integer NOT NULL CHECK(invoice_line_index >= 0),
    invoice_item_name text NOT NULL,
    material_id uuid NOT NULL REFERENCES public.material(id),
    material_code varchar(50) NOT NULL,
    material_name text NOT NULL,
    material_created boolean NOT NULL,
    warehouse_id uuid NOT NULL REFERENCES public.warehouse(id),
    inventory_id uuid NOT NULL REFERENCES public.inventory(id),
    batch_no varchar(50) NOT NULL,
    invoice_quantity numeric(20,6) NOT NULL CHECK(invoice_quantity > 0),
    invoice_unit varchar(20) NOT NULL,
    bom_unit_per_invoice_unit numeric(20,8) NOT NULL CHECK(bom_unit_per_invoice_unit > 0),
    bom_quantity numeric(20,6) NOT NULL CHECK(bom_quantity > 0),
    purchase_unit_price numeric(20,4) NOT NULL CHECK(purchase_unit_price >= 0),
    vat_rate numeric(8,3) NOT NULL CHECK(vat_rate >= 0 AND vat_rate <= 100),
    UNIQUE(receipt_id,invoice_line_index)
);
CREATE INDEX IF NOT EXISTS invoice_pdf_receipt_line_material_idx
 ON public.inventory_invoice_pdf_receipt_line(material_id,inventory_id);
COMMENT ON COLUMN public.inventory_invoice_pdf_receipt_line.invoice_item_name IS
 'Unmodified original description read from the supplier PDF; not the internal material name.';
