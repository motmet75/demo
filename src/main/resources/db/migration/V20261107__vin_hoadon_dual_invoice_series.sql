-- One VIN-HOADON company/login can have distinct registered POS and normal invoice series.
-- Nullable columns: existing integrations stay valid and can be completed in the UI.
ALTER TABLE public.vin_hoadon_company_config
    ADD COLUMN IF NOT EXISTS pos_invoice_template_code varchar(11),
    ADD COLUMN IF NOT EXISTS pos_invoice_series varchar(8),
    ADD COLUMN IF NOT EXISTS normal_invoice_template_code varchar(11),
    ADD COLUMN IF NOT EXISTS normal_invoice_series varchar(8);

-- Preserve existing series. Backfill ONLY the matching type, without inventing a
-- second Mẫu số or assuming an invoice series for the next year.
UPDATE public.vin_hoadon_company_config
SET pos_invoice_template_code = invoice_template_code,
    pos_invoice_series = invoice_series
WHERE pos_invoice_template_code IS NULL
  AND pos_invoice_series IS NULL
  AND invoice_series ~ '^[A-Z][0-9]{2}M[A-Z0-9]{2}$';

UPDATE public.vin_hoadon_company_config
SET normal_invoice_template_code = invoice_template_code,
    normal_invoice_series = invoice_series
WHERE normal_invoice_template_code IS NULL
  AND normal_invoice_series IS NULL
  AND invoice_series ~ '^[A-Z][0-9]{2}T[A-Z0-9]{2}$';
