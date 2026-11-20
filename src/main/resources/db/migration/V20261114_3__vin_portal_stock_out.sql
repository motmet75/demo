CREATE TABLE IF NOT EXISTS public.vin_portal_selling_invoice (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    provider_invoice_id bigint NOT NULL,
    invoice_serial varchar(80) NOT NULL,
    invoice_number varchar(80) NOT NULL,
    invoice_date date NOT NULL,
    invoice_type integer NOT NULL,
    invoice_status integer NOT NULL,
    tax_status integer NOT NULL,
    currency varchar(10) NOT NULL,
    buyer_name varchar(500),
    buyer_tax_id varchar(30),
    buyer_address varchar(1000),
    subtotal numeric(20,4),
    vat numeric(20,4),
    total numeric(20,4),
    source_json jsonb NOT NULL,
    checked_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, company_id, provider_invoice_id),
    UNIQUE (tenant_id, company_id, invoice_serial, invoice_number)
);

ALTER TABLE public.inventory_invoice_stock_out
    ADD COLUMN IF NOT EXISTS vin_portal_invoice_id uuid;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_stock_out_vin_portal_invoice') THEN
        ALTER TABLE public.inventory_invoice_stock_out
            ADD CONSTRAINT fk_stock_out_vin_portal_invoice
            FOREIGN KEY (vin_portal_invoice_id) REFERENCES public.vin_portal_selling_invoice(id);
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_out_vin_portal_invoice
    ON public.inventory_invoice_stock_out (tenant_id, company_id, vin_portal_invoice_id)
    WHERE vin_portal_invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_out_invoice_identity
    ON public.inventory_invoice_stock_out (tenant_id, company_id, invoice_serial, invoice_number);
