-- Historical NNC portal rows, mapped to current demo materials and lots.
-- These tables are audit history: loading them must not change on-hand stock,
-- which was already seeded from the legacy net balance.
CREATE TABLE IF NOT EXISTS public.nnc_legacy_purchase_line (
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    source_id integer NOT NULL,
    material_id uuid NOT NULL REFERENCES public.material(id),
    inventory_id uuid NOT NULL REFERENCES public.inventory(id),
    invoice_number text NOT NULL,
    invoice_date date,
    supplier_name text,
    description text NOT NULL,
    quantity numeric(20,6) NOT NULL,
    unit text,
    unit_price numeric(20,4) NOT NULL,
    subtotal numeric(20,4) NOT NULL,
    vat_rate numeric(8,3),
    currency varchar(3) NOT NULL DEFAULT 'VND' CHECK (currency='VND'),
    source_row jsonb NOT NULL,
    PRIMARY KEY (tenant_id, company_id, source_id)
);
CREATE INDEX IF NOT EXISTS nnc_legacy_purchase_material_idx
    ON public.nnc_legacy_purchase_line (tenant_id, company_id, material_id);

CREATE TABLE IF NOT EXISTS public.nnc_legacy_inventory_movement (
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    source_id integer NOT NULL,
    material_id uuid NOT NULL REFERENCES public.material(id),
    inventory_id uuid NOT NULL REFERENCES public.inventory(id),
    movement_type varchar(8) NOT NULL CHECK (movement_type IN ('IN','OUT')),
    quantity numeric(20,6) NOT NULL CHECK (quantity > 0),
    movement_date timestamp,
    reference_number text,
    unit text,
    unit_price numeric(20,4),
    currency varchar(3) NOT NULL DEFAULT 'VND' CHECK (currency='VND'),
    source_row jsonb NOT NULL,
    PRIMARY KEY (tenant_id, company_id, source_id)
);
CREATE INDEX IF NOT EXISTS nnc_legacy_movement_material_idx
    ON public.nnc_legacy_inventory_movement (tenant_id, company_id, material_id, movement_date);
