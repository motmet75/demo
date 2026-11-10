-- Keep the original foreign-currency invoice figures and customs taxes
-- separately from the VND inventory unit cost. All amounts are per receipt
-- (line), not inferred from the current customs tariff table.
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS customs_foreign_unit_price numeric,
  ADD COLUMN IF NOT EXISTS customs_foreign_currency varchar(3),
  ADD COLUMN IF NOT EXISTS customs_goods_value_vnd numeric,
  ADD COLUMN IF NOT EXISTS customs_import_duty_vnd numeric,
  ADD COLUMN IF NOT EXISTS customs_import_vat_vnd numeric,
  ADD COLUMN IF NOT EXISTS customs_import_vat_rate numeric,
  ADD COLUMN IF NOT EXISTS customs_additional_costs_vnd numeric,
  ADD COLUMN IF NOT EXISTS customs_vat_creditable boolean,
  ADD COLUMN IF NOT EXISTS customs_historical_fx_rate numeric,
  ADD COLUMN IF NOT EXISTS customs_landed_total_vnd numeric;

ALTER TABLE public.inventory_customs_declaration_line
  ADD COLUMN IF NOT EXISTS foreign_invoice_value numeric,
  ADD COLUMN IF NOT EXISTS goods_value_vnd numeric,
  ADD COLUMN IF NOT EXISTS goods_value_source varchar(32),
  ADD COLUMN IF NOT EXISTS import_duty_vnd numeric,
  ADD COLUMN IF NOT EXISTS import_vat_vnd numeric,
  ADD COLUMN IF NOT EXISTS import_vat_rate numeric,
  ADD COLUMN IF NOT EXISTS additional_costs_vnd numeric,
  ADD COLUMN IF NOT EXISTS import_vat_creditable boolean,
  ADD COLUMN IF NOT EXISTS historical_fx_rate numeric,
  ADD COLUMN IF NOT EXISTS landed_total_vnd numeric,
  ADD COLUMN IF NOT EXISTS landed_unit_vnd numeric;
