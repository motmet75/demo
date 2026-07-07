ALTER TABLE company
    ADD COLUMN IF NOT EXISTS realtime_inventory BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE company
    ADD COLUMN IF NOT EXISTS shop_processing_inventory_recheck BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE shop_order
    ADD COLUMN IF NOT EXISTS audit_material_later BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE shop_order
    ADD COLUMN IF NOT EXISTS material_audit_status VARCHAR(30) NOT NULL DEFAULT 'NOT_CHECKED';

ALTER TABLE shop_order
    ADD COLUMN IF NOT EXISTS material_audit_note TEXT;

ALTER TABLE shop_order
    ADD COLUMN IF NOT EXISTS inventory_checked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE shop_order
    ADD COLUMN IF NOT EXISTS material_deducted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE model
    ADD COLUMN IF NOT EXISTS shop_available_units_override NUMERIC(18, 3);

CREATE TABLE IF NOT EXISTS shop_material_audit (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    order_id UUID NOT NULL,
    order_item_id UUID,
    model_id UUID,
    model_name TEXT,
    order_code VARCHAR(50),
    order_number INTEGER,
    material_id UUID NOT NULL,
    material_code VARCHAR(50),
    material_name TEXT,
    required_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    available_before_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    deducted_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    waiting_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    source VARCHAR(30),
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_shop_material_audit_scope_status
    ON shop_material_audit (tenant_id, company_id, status);

CREATE INDEX IF NOT EXISTS idx_shop_material_audit_order
    ON shop_material_audit (order_id);

CREATE INDEX IF NOT EXISTS idx_shop_material_audit_material
    ON shop_material_audit (tenant_id, company_id, material_id);

CREATE INDEX IF NOT EXISTS idx_shop_material_audit_created
    ON shop_material_audit (tenant_id, company_id, created_at);
