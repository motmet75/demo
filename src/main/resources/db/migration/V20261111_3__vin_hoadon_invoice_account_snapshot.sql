ALTER TABLE public.vin_hoadon_shop_invoice
    ADD COLUMN IF NOT EXISTS seller_tax_code varchar(14),
    ADD COLUMN IF NOT EXISTS api_username varchar(255);

UPDATE public.vin_hoadon_shop_invoice invoice
SET seller_tax_code = COALESCE(invoice.seller_tax_code, invoice.request_payload ->> 'doanhnghiep_mst'),
    api_username = COALESCE(invoice.api_username, config.api_username)
FROM public.vin_hoadon_company_config config
WHERE config.tenant_id = invoice.tenant_id
  AND config.company_id = invoice.company_id
  AND (invoice.seller_tax_code IS NULL OR invoice.api_username IS NULL);
