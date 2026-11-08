-- Customs declaration VAT is a reviewed accounting estimate, not import duty.
-- Keep NULL totals when any declared line has no unit price.
ALTER TABLE public.inventory_customs_declaration
    ADD COLUMN IF NOT EXISTS declared_subtotal numeric(24,4),
    ADD COLUMN IF NOT EXISTS vat_amount numeric(24,4),
    ADD COLUMN IF NOT EXISTS declared_total_after_vat numeric(24,4);
ALTER TABLE public.inventory_customs_declaration_line
    ADD COLUMN IF NOT EXISTS vat_rate numeric(8,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vat_amount numeric(24,4);
