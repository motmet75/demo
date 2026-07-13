ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 10) NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS warehouse_import_unit VARCHAR(30);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS warehouse_import_quantity NUMERIC(18, 6);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS bom_unit_per_warehouse_unit NUMERIC(18, 6);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS warehouse_import_unit_price NUMERIC(18, 6);

ALTER TABLE inventory ALTER COLUMN unit_price TYPE NUMERIC(18, 10);