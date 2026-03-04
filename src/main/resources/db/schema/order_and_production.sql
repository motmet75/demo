-- =====================================================================
-- Order & Production Related Tables (new)
-- =====================================================================

-- 1. Order Header (sales order or production order)
CREATE TABLE public.order_header (
    id                  uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    order_number        character varying(50) UNIQUE NOT NULL,
    order_type          character varying(20) NOT NULL,          -- 'SALES', 'PRODUCTION', 'TRANSFER', 'INTERNAL'
    status              character varying(30) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT → CONFIRMED → IN_PRODUCTION → PARTIALLY_COMPLETED → COMPLETED → CANCELLED → CANCEL_PENDING
    customer_id         uuid,                                       -- optional, if sales order
    production_batch_id uuid,                                       -- if production order
    planned_start_date  date,
    planned_end_date    date,
    actual_start_date   timestamp with time zone,
    actual_end_date     timestamp with time zone,
    total_planned_qty   numeric(14,4),
    total_actual_qty    numeric(14,4),
    notes               text,
    tenant_id           uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id          uuid NOT NULL,
    created_at          timestamp with time zone DEFAULT now(),
    created_by          character varying(100),
    updated_at          timestamp with time zone DEFAULT now(),
    updated_by          character varying(100)
);

-- 2. Order Line (one line = one product or material item)
CREATE TABLE public.order_line (
    id                  uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    order_id            uuid NOT NULL REFERENCES public.order_header(id) ON DELETE CASCADE,
    line_number         integer NOT NULL,
    line_type           character varying(20) NOT NULL,          -- 'MODEL' or 'MATERIAL'
    model_id            uuid,                                       -- if line_type = 'MODEL'
    material_id         uuid,                                       -- if line_type = 'MATERIAL'
    quantity_ordered    numeric(14,4) NOT NULL,
    quantity_produced   numeric(14,4) DEFAULT 0,
    quantity_delivered  numeric(14,4) DEFAULT 0,
    quantity_cancelled  numeric(14,4) DEFAULT 0,
    unit                character varying(20) NOT NULL,
    unit_price          numeric(18,4),
    line_status         character varying(20) DEFAULT 'PENDING',
    bom_calculation_id  uuid,                                       -- link to bom_calculation if MODEL line
    notes               text,
    tenant_id           uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id          uuid NOT NULL,
    created_at          timestamp with time zone DEFAULT now(),
    updated_at          timestamp with time zone DEFAULT now()
);

-- 3. Production Run / Batch (optional but very useful for traceability)
CREATE TABLE public.production_run (
    id                  uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    production_batch_id uuid NOT NULL UNIQUE,
    order_id            uuid REFERENCES public.order_header(id),
    model_id            uuid NOT NULL,
    target_qty          numeric(14,4) NOT NULL,
    produced_qty        numeric(14,4) DEFAULT 0,
    scrapped_qty        numeric(14,4) DEFAULT 0,
    status              character varying(20) NOT NULL DEFAULT 'PLANNED',
    -- PLANNED → STARTED → IN_PROGRESS → COMPLETED → CANCELLED
    start_date          timestamp with time zone,
    end_date            timestamp with time zone,
    warehouse_id        uuid,                                       -- production area / line
    tenant_id           uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id          uuid NOT NULL,
    created_at          timestamp with time zone DEFAULT now(),
    updated_at          timestamp with time zone DEFAULT now()
);

-- 4. Production Consumption Detail (optional - if you want per-run granularity)
-- (alternative: you can use order_consumption_log for this)
CREATE TABLE public.production_consumption (
    id                      uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    production_run_id       uuid NOT NULL REFERENCES public.production_run(id),
    material_id             uuid NOT NULL,
    planned_qty             numeric(14,4) NOT NULL,
    effective_planned_qty   numeric(14,4) NOT NULL,
    actual_consumed_qty     numeric(14,4),
    variance_qty            numeric(14,4) GENERATED ALWAYS AS (COALESCE(actual_consumed_qty, effective_planned_qty) - planned_qty) STORED,
    tenant_id               uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id              uuid NOT NULL,
    created_at              timestamp with time zone DEFAULT now(),
    updated_at              timestamp with time zone DEFAULT now()
);

-- =====================================================================
-- Optional: Add some useful indexes
-- =====================================================================

CREATE INDEX idx_order_header_status         ON public.order_header(status);
CREATE INDEX idx_order_header_order_number   ON public.order_header(order_number);
CREATE INDEX idx_order_line_order_id         ON public.order_line(order_id);
CREATE INDEX idx_order_line_model_material   ON public.order_line(model_id, material_id);
CREATE INDEX idx_production_run_batch_id     ON public.production_run(production_batch_id);
CREATE INDEX idx_production_consumption_run  ON public.production_consumption(production_run_id);