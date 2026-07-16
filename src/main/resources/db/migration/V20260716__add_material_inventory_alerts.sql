ALTER TABLE material
    ADD COLUMN IF NOT EXISTS inventory_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE material
    ADD COLUMN IF NOT EXISTS inventory_alert_quantity NUMERIC(18, 4);

ALTER TABLE material
    ADD COLUMN IF NOT EXISTS inventory_alert_percentage NUMERIC(8, 4);

CREATE INDEX IF NOT EXISTS idx_material_inventory_alert_scope
    ON material (tenant_id, company_id, inventory_alert_enabled);
