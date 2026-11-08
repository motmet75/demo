-- Invoice-linked stock out, additive schema.
-- The source PDF is stored by Invoice Desk (invoice_desk_document); this
-- ledger stores the document UUID, reviewed buyer data and stock movements.
-- Do not backfill or automatically deduct stock when applying this migration.
CREATE TABLE IF NOT EXISTS public.inventory_invoice_stock_out (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    invoice_desk_document_id uuid NOT NULL,
    invoice_date date NOT NULL,
    invoice_serial varchar(80) NOT NULL,
    invoice_number varchar(80) NOT NULL,
    buyer_type varchar(20) NOT NULL CHECK (buyer_type IN ('PERSONAL','COMPANY')),
    buyer_name text NOT NULL,
    buyer_tax_id varchar(30),
    buyer_address text,
    export_type varchar(30) NOT NULL CHECK (export_type IN ('SALE','WARRANTY','GIFT','OTHER')),
    vat_rate numeric(8,3) NOT NULL,
    invoice_subtotal numeric(20,4),
    invoice_vat numeric(20,4),
    invoice_total numeric(20,4),
    source_sha256 varchar(64) NOT NULL,
    reviewed_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    confirmed_by varchar(100) NOT NULL,
    confirmed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id,company_id,invoice_desk_document_id),
    UNIQUE (tenant_id,company_id,invoice_serial,invoice_number)
);
CREATE INDEX IF NOT EXISTS inventory_invoice_stock_out_date_idx
 ON public.inventory_invoice_stock_out (tenant_id,company_id,invoice_date DESC);

CREATE TABLE IF NOT EXISTS public.inventory_invoice_stock_out_line (
    id uuid PRIMARY KEY,
    stock_out_id uuid NOT NULL REFERENCES public.inventory_invoice_stock_out(id) ON DELETE RESTRICT,
    invoice_line_index integer NOT NULL CHECK (invoice_line_index >= 0),
    invoice_description text NOT NULL,
    inventory_id uuid NOT NULL REFERENCES public.inventory(id),
    material_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    quantity numeric(20,6) NOT NULL CHECK (quantity > 0),
    unit varchar(40),
    sale_unit_price numeric(20,4) NOT NULL CHECK (sale_unit_price >= 0),
    vat_rate numeric(8,3) NOT NULL,
    line_subtotal numeric(20,4) NOT NULL,
    movement_id uuid NOT NULL UNIQUE REFERENCES public.inventory_movement(id),
    UNIQUE (stock_out_id,invoice_line_index,inventory_id)
);
CREATE INDEX IF NOT EXISTS inventory_invoice_stock_out_line_inventory_idx
 ON public.inventory_invoice_stock_out_line (inventory_id,stock_out_id);

COMMENT ON TABLE public.inventory_invoice_stock_out IS
 'Confirmed stock deductions linked to reviewed customer invoices. Never auto-deduct from OCR.';
