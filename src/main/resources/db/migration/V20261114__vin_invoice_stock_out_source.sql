-- A confirmed stock-out can originate from an Invoice Desk PDF or a local
-- VIN-HOADON invoice. Existing PDF records keep their original link.
ALTER TABLE public.inventory_invoice_stock_out
    ALTER COLUMN invoice_desk_document_id DROP NOT NULL;
ALTER TABLE public.inventory_invoice_stock_out
    ADD COLUMN IF NOT EXISTS vin_hoadon_invoice_id uuid;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname='inventory_stock_out_one_source_chk'
                     AND conrelid='public.inventory_invoice_stock_out'::regclass) THEN
        ALTER TABLE public.inventory_invoice_stock_out
            ADD CONSTRAINT inventory_stock_out_one_source_chk CHECK (
                (invoice_desk_document_id IS NOT NULL) <> (vin_hoadon_invoice_id IS NOT NULL));
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_out_vin_invoice_uq
    ON public.inventory_invoice_stock_out (tenant_id, company_id, vin_hoadon_invoice_id)
    WHERE vin_hoadon_invoice_id IS NOT NULL;
