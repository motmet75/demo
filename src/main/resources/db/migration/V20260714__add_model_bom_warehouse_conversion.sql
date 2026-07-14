ALTER TABLE model_bom ADD COLUMN IF NOT EXISTS warehouse_qty NUMERIC(18, 6);
ALTER TABLE model_bom ADD COLUMN IF NOT EXISTS warehouse_unit VARCHAR(30);
ALTER TABLE model_bom ADD COLUMN IF NOT EXISTS bom_unit_per_warehouse_unit NUMERIC(18, 6);