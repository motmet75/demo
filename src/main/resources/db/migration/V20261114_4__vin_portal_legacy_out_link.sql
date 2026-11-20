CREATE TABLE IF NOT EXISTS public.vin_portal_legacy_out_link (
    invoice_id uuid PRIMARY KEY REFERENCES public.vin_portal_selling_invoice(id),
    movement_id uuid NOT NULL UNIQUE REFERENCES public.inventory_movement(id),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    source_movement_id integer NOT NULL,
    match_note text NOT NULL,
    linked_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, company_id, source_movement_id)
);
