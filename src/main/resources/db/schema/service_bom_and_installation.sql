-- Field-service BOMs for camera installation / repair work.
-- Run after bom_core_schema.sql and order_and_production.sql.

CREATE TABLE IF NOT EXISTS public.service_bom (
    id uuid PRIMARY KEY DEFAULT public.uuid_v7(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    service_code varchar(50) NOT NULL,
    service_name text NOT NULL,
    service_type varchar(40) NOT NULL DEFAULT 'CAMERA_INSTALLATION',
    active boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, company_id, service_code)
);

CREATE TABLE IF NOT EXISTS public.service_bom_item (
    id uuid PRIMARY KEY DEFAULT public.uuid_v7(),
    service_bom_id uuid NOT NULL REFERENCES public.service_bom(id) ON DELETE CASCADE,
    cost_type varchar(30) NOT NULL,
    description text NOT NULL,
    quantity numeric(14,4) NOT NULL DEFAULT 1,
    unit varchar(20) NOT NULL DEFAULT 'job',
    unit_cost numeric(18,4) NOT NULL DEFAULT 0,
    material_id uuid,
    optional boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_installation (
    id uuid PRIMARY KEY DEFAULT public.uuid_v7(),
    order_id uuid NOT NULL UNIQUE REFERENCES public.order_header(id) ON DELETE CASCADE,
    service_bom_id uuid NOT NULL REFERENCES public.service_bom(id),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    deployment_address text NOT NULL,
    contact_name varchar(120),
    contact_phone varchar(40),
    planned_start_date date,
    planned_end_date date,
    overnight boolean NOT NULL DEFAULT false,
    overnight_nights numeric(10,2) NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'PLANNED',
    notes text,
    total_service_cost numeric(18,4) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_installation_cost (
    id uuid PRIMARY KEY DEFAULT public.uuid_v7(),
    installation_id uuid NOT NULL REFERENCES public.service_installation(id) ON DELETE CASCADE,
    cost_type varchar(30) NOT NULL,
    description text NOT NULL,
    quantity numeric(14,4) NOT NULL,
    unit varchar(20) NOT NULL,
    unit_cost numeric(18,4) NOT NULL,
    total_cost numeric(18,4) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_bom_scope ON public.service_bom(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_service_installation_scope ON public.service_installation(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_service_installation_cost_installation ON public.service_installation_cost(installation_id);
