-- =====================================================================
-- Order & Production Tables Migration
-- Run this ONCE against your database.
-- Uses uuid_v7() function (must be installed before running).
-- =====================================================================

-- 1. order_header
CREATE TABLE IF NOT EXISTS public.order_header (
    id                  uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    order_number        character varying(50) UNIQUE NOT NULL,
    order_type          character varying(20) NOT NULL,
    -- 'SALES' | 'PRODUCTION' | 'TRANSFER' | 'INTERNAL'
    status              character varying(30) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT → CONFIRMED → IN_PRODUCTION → PARTIALLY_COMPLETED → COMPLETED → CANCELLED → CANCEL_PENDING
    customer_id         uuid,
    production_batch_id uuid,
    planned_start_date  date,
    planned_end_date    date,
    actual_start_date   timestamp with time zone,
    actual_end_date     timestamp with time zone,
    total_planned_qty   numeric(14,4),
    total_actual_qty    numeric(14,4),
    notes               text,
    tenant_id           uuid NOT NULL,
    company_id          uuid NOT NULL,
    created_at          timestamp with time zone DEFAULT now(),
    created_by          character varying(100),
    updated_at          timestamp with time zone DEFAULT now(),
    updated_by          character varying(100)
);

-- 2. order_line
CREATE TABLE IF NOT EXISTS public.order_line (
    id                  uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    order_id            uuid NOT NULL REFERENCES public.order_header(id) ON DELETE CASCADE,
    line_number         integer NOT NULL,
    line_type           character varying(20) NOT NULL,
    -- 'MODEL' | 'MATERIAL'
    model_id            uuid,
    material_id         uuid,
    quantity_ordered    numeric(14,4) NOT NULL,
    quantity_produced   numeric(14,4) DEFAULT 0,
    quantity_delivered  numeric(14,4) DEFAULT 0,
    quantity_cancelled  numeric(14,4) DEFAULT 0,
    unit                character varying(20) NOT NULL,
    unit_price          numeric(18,4),
    line_status         character varying(20) DEFAULT 'PENDING',
    bom_calculation_id  uuid,
    notes               text,
    tenant_id           uuid NOT NULL,
    company_id          uuid NOT NULL,
    created_at          timestamp with time zone DEFAULT now(),
    updated_at          timestamp with time zone DEFAULT now()
);

-- 3. production_run
CREATE TABLE IF NOT EXISTS public.production_run (
    id                  uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    production_batch_id uuid NOT NULL UNIQUE,
    order_id            uuid REFERENCES public.order_header(id),
    order_line_id       uuid REFERENCES public.order_line(id),
    model_id            uuid NOT NULL,
    target_qty          numeric(14,4) NOT NULL,
    produced_qty        numeric(14,4) DEFAULT 0,
    scrapped_qty        numeric(14,4) DEFAULT 0,
    status              character varying(20) NOT NULL DEFAULT 'PLANNED',
    -- PLANNED → STARTED → IN_PROGRESS → COMPLETED → CANCELLED
    start_date          timestamp with time zone,
    end_date            timestamp with time zone,
    warehouse_id        uuid,
    tenant_id           uuid NOT NULL,
    company_id          uuid NOT NULL,
    created_at          timestamp with time zone DEFAULT now(),
    updated_at          timestamp with time zone DEFAULT now()
);

-- 4. production_consumption (per-run granular material tracking)
CREATE TABLE IF NOT EXISTS public.production_consumption (
    id                      uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    production_run_id       uuid NOT NULL REFERENCES public.production_run(id),
    material_id             uuid NOT NULL,
    planned_qty             numeric(14,4) NOT NULL,
    effective_planned_qty   numeric(14,4) NOT NULL,
    actual_consumed_qty     numeric(14,4),
    variance_qty            numeric(14,4) GENERATED ALWAYS AS
                                (COALESCE(actual_consumed_qty, effective_planned_qty) - planned_qty) STORED,
    tenant_id               uuid NOT NULL,
    company_id              uuid NOT NULL,
    created_at              timestamp with time zone DEFAULT now(),
    updated_at              timestamp with time zone DEFAULT now()
);

-- =====================================================================
-- Indexes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_production_consumption_run  ON public.production_consumption(production_run_id);
CREATE INDEX IF NOT EXISTS idx_production_consumption_mat  ON public.production_consumption(material_id);
CREATE INDEX IF NOT EXISTS idx_production_consumption_tc   ON public.production_consumption(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_order_header_status         ON public.order_header(status);
CREATE INDEX IF NOT EXISTS idx_order_header_order_number   ON public.order_header(order_number);
CREATE INDEX IF NOT EXISTS idx_order_header_tenant_company ON public.order_header(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_order_header_order_type     ON public.order_header(order_type);

CREATE INDEX IF NOT EXISTS idx_order_line_order_id         ON public.order_line(order_id);
CREATE INDEX IF NOT EXISTS idx_order_line_model_material   ON public.order_line(model_id, material_id);
CREATE INDEX IF NOT EXISTS idx_order_line_tenant_company   ON public.order_line(tenant_id, company_id);

CREATE INDEX IF NOT EXISTS idx_production_run_batch_id     ON public.production_run(production_batch_id);
CREATE INDEX IF NOT EXISTS idx_production_run_order_id     ON public.production_run(order_id);
CREATE INDEX IF NOT EXISTS idx_production_run_tenant_company ON public.production_run(tenant_id, company_id);
