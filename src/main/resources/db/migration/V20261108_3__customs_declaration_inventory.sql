-- Customs Excel <IMP> based intake and shipment, with audit of reviewed rows.
CREATE TABLE IF NOT EXISTS public.inventory_customs_declaration (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    file_name text NOT NULL,
    sha256 varchar(64) NOT NULL,
    declaration_number varchar(80),
    declaration_date date,
    status varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED')),
    direction varchar(8) CHECK(direction IN ('IN','OUT')),
    source_json jsonb NOT NULL,
    confirmed_by varchar(100),
    confirmed_at timestamptz,
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id,company_id,sha256)
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_customs_declaration_posted_uniq
 ON public.inventory_customs_declaration(tenant_id,company_id,declaration_number,direction)
 WHERE status='POSTED';
CREATE TABLE IF NOT EXISTS public.inventory_customs_declaration_line (
    id uuid PRIMARY KEY,
    declaration_id uuid NOT NULL REFERENCES public.inventory_customs_declaration(id),
    line_index integer NOT NULL,
    hs_code varchar(40),
    declared_description text NOT NULL,
    material_id uuid NOT NULL REFERENCES public.material(id),
    original_material_name text NOT NULL,
    warehouse_id uuid NOT NULL REFERENCES public.warehouse(id),
    inventory_id uuid NOT NULL REFERENCES public.inventory(id),
    batch_no varchar(50) NOT NULL,
    direction varchar(8) NOT NULL,
    quantity_declared numeric(20,6) NOT NULL,
    quantity_stock numeric(20,6) NOT NULL,
    conversion_ratio numeric(20,8) NOT NULL,
    unit_declared varchar(50),
    unit_stock varchar(50),
    unit_price numeric(20,4),
    currency varchar(8),
    country_of_origin varchar(100),
    UNIQUE(declaration_id,line_index)
);
