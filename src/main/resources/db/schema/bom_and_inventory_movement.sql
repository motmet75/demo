-- =====================================================================
-- Core Model & BOM Tables
-- =====================================================================

CREATE TABLE public.model (
    id          uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    model_code  character varying(50) NOT NULL,
    model_name  text NOT NULL,
    is_active   boolean DEFAULT true,
    created_at  timestamp without time zone DEFAULT now(),
    tenant_id   uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id  uuid NOT NULL,
    hs_code     varchar(20),
    co_criteria varchar(100)
);

CREATE TABLE public.model_bom (
    id          uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    model_id    uuid NOT NULL,
    material_id uuid NOT NULL,
    qty_per_unit numeric(14,4) NOT NULL,
    tenant_id   uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id  uuid NOT NULL
);

CREATE TABLE public.bom (
    id          uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    model_name  character varying(100) NOT NULL,
    version     integer NOT NULL,
    status      character varying(20) NOT NULL,
    created_at  timestamp without time zone DEFAULT now(),
    tenant_id   uuid DEFAULT public.uuid_v7() NOT NULL,
    model_id    uuid NOT NULL,
    company_id  uuid NOT NULL
);

CREATE TABLE public.bom_calculation (
    id          uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    bom_id      uuid NOT NULL,
    model_name  character varying(100) NOT NULL,
    target_qty  numeric(14,4) NOT NULL,
    status      character varying(20) NOT NULL,
    created_at  timestamp without time zone DEFAULT now(),
    tenant_id   uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id  uuid NOT NULL
);

CREATE TABLE public.bom_calculation_item (
    id            uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    calculation_id uuid NOT NULL,
    material_id   uuid NOT NULL,
    required_qty  numeric(14,4) NOT NULL,
    available_qty numeric(14,4) NOT NULL,
    shortage_qty  numeric(14,4) NOT NULL,
    tenant_id     uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id    uuid NOT NULL
);

CREATE TABLE public.bom_item (
    id            uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    bom_id        uuid NOT NULL,
    parent_item_id uuid,
    material_id   uuid NOT NULL,
    quantity      double precision NOT NULL,
    level         integer NOT NULL,
    tenant_id     uuid DEFAULT public.uuid_v7() NOT NULL,
    created_at    timestamp(6) with time zone,
    company_id    uuid NOT NULL
);

-- =====================================================================
-- Inventory & History Tables
-- =====================================================================

CREATE TABLE public.inventory_history (
    id            uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    material_id   uuid NOT NULL,
    warehouse_id  uuid NOT NULL,
    quantity      numeric(14,4) NOT NULL,
    snapshot_date date NOT NULL,
    tenant_id     uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id    uuid NOT NULL
);

CREATE TABLE public.inventory_lock (
    id            uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    material_id   uuid NOT NULL,
    warehouse_id  uuid NOT NULL,
    lock_type     character varying(30) NOT NULL,
    quantity      numeric(14,4) NOT NULL,
    reference_type character varying(50),
    reference_id  uuid,
    status        character varying(20) NOT NULL,
    created_at    timestamp without time zone DEFAULT now(),
    tenant_id     uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id    uuid NOT NULL
);

-- =====================================================================
-- Quota, Consumption & Movement Tables (new/updated)
-- =====================================================================

CREATE TABLE public.material_quota (
    id              uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    material_id     uuid NOT NULL,
    quota_period    date NOT NULL,
    allocated_quota numeric(18,4) NOT NULL DEFAULT 0,
    consumed_quota  numeric(18,4) NOT NULL DEFAULT 0,
    remaining_quota numeric(18,4) GENERATED ALWAYS AS (allocated_quota - consumed_quota) STORED,
    tenant_id       uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id      uuid NOT NULL,
    created_at      timestamp with time zone DEFAULT now(),
    updated_at      timestamp with time zone DEFAULT now(),
    CONSTRAINT uk_material_quota_period UNIQUE (material_id, tenant_id, company_id, quota_period)
);

CREATE TABLE public.order_consumption_log (
    id                  uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    order_id            uuid NOT NULL,
    bom_calculation_id  uuid,
    material_id         uuid NOT NULL,
    planned_qty         numeric(14,4) NOT NULL,
    effective_planned_qty numeric(14,4) NOT NULL,
    real_consumption_qty numeric(14,4),
    variance_qty        numeric(14,4) GENERATED ALWAYS AS (COALESCE(real_consumption_qty, effective_planned_qty) - planned_qty) STORED,
    status              character varying(20) NOT NULL DEFAULT 'PROVISIONAL',
    tenant_id           uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id          uuid NOT NULL,
    created_at          timestamp with time zone DEFAULT now(),
    updated_at          timestamp with time zone DEFAULT now()
);

CREATE TABLE public.inventory_movement (
    id                  uuid DEFAULT public.uuid_v7() NOT NULL PRIMARY KEY,
    material_id         uuid NOT NULL,
    tenant_id           uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id          uuid NOT NULL,
    
    from_warehouse_id   uuid,
    to_warehouse_id     uuid,
    
    quantity            numeric(14,4) NOT NULL,
    unit                character varying(20) NOT NULL,
    
    movement_type       character varying(50) NOT NULL,
    reason              character varying(100),
    
    reference_type      character varying(50),
    reference_id        uuid,
    inventory_id        uuid,
    batch_no            character varying(50),
    production_batch_id uuid,
    
    status              character varying(20) NOT NULL DEFAULT 'COMPLETED',
    
    created_at          timestamp with time zone DEFAULT now(),
    created_by          character varying(100),
    confirmed_at        timestamp with time zone,
    confirmed_by        character varying(100),
    notes               text
);