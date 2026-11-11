ALTER TABLE public.vin_hoadon_company_config
    ADD COLUMN IF NOT EXISTS api_environment varchar(10) NOT NULL DEFAULT 'PRODUCTION';

ALTER TABLE public.vin_hoadon_shop_invoice
    ADD COLUMN IF NOT EXISTS api_environment varchar(10) NOT NULL DEFAULT 'PRODUCTION';

ALTER TABLE public.vin_hoadon_company_config
    DROP CONSTRAINT IF EXISTS ck_vin_hoadon_config_environment;
ALTER TABLE public.vin_hoadon_company_config
    ADD CONSTRAINT ck_vin_hoadon_config_environment
        CHECK (api_environment IN ('PRODUCTION', 'DEMO'));

ALTER TABLE public.vin_hoadon_shop_invoice
    DROP CONSTRAINT IF EXISTS ck_vin_hoadon_invoice_environment;
ALTER TABLE public.vin_hoadon_shop_invoice
    ADD CONSTRAINT ck_vin_hoadon_invoice_environment
        CHECK (api_environment IN ('PRODUCTION', 'DEMO'));
