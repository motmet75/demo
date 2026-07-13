-- ============================================================================
-- ALTER TABLE QUERIES FOR INVENTORY TABLE
-- Date: 2026-02-11
-- Purpose: Add missing fields from InventoryEntity JPA entity to match SQL schema
-- ============================================================================

-- Add contract relationship fields (no foreign key as per requirement)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS contract_id UUID;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS contract_code VARCHAR(50);

-- Add denormalized code fields for quick reference
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS material_code VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS warehouse_code VARCHAR(50);

-- Add order/deduction tracking
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS order_to_deduction VARCHAR(100);

-- Add user information
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS user_name VARCHAR(100) NOT NULL DEFAULT 'system';

-- Add unit and pricing information
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NOT NULL DEFAULT 'pcs';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 10) NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS warehouse_import_unit VARCHAR(30);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS warehouse_import_quantity NUMERIC(18, 6);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS bom_unit_per_warehouse_unit NUMERIC(18, 6);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS warehouse_import_unit_price NUMERIC(18, 6);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'USD';

-- Add customs/trade information
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS hs_code VARCHAR(20);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS origin_type VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS origin_country CHAR(2);

-- Add document references
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS xform_no VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS cds_no VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS purchase_no VARCHAR(50);

-- Add quantity tracking fields
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity_reserved NUMERIC(18, 3);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS material_quota NUMERIC(18, 3);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS material_quota_percentage NUMERIC(8, 5);

-- Update existing quantity columns precision if needed (optional - may require data migration)
-- ALTER TABLE inventory ALTER COLUMN quantity_on_hand TYPE NUMERIC(18, 3);
-- ALTER TABLE inventory ALTER COLUMN quantity_locked TYPE NUMERIC(18, 3);

-- Add date/timestamp fields
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS xform_date DATE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS purchase_date_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS cds_date_time TIMESTAMP WITH TIME ZONE;

-- Rename date columns if they exist with old names (adjust based on actual schema)
-- If columns are named differently:
-- ALTER TABLE inventory RENAME COLUMN expiration_date TO expiration_date_time;
-- ALTER TABLE inventory RENAME COLUMN production_date TO production_date_time;

-- Add timestamp fields if not exists
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS production_date_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiration_date_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS modified_time TIMESTAMP WITH TIME ZONE;

-- Add status flags
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Add composite unique constraint (prevents duplicate material in same batch/warehouse)
-- Drop if exists first to avoid conflicts
  
    
    ALTER TABLE inventory
    ADD CONSTRAINT uk_inventory_company_tenant_wh_material_batch
    UNIQUE (company_id, tenant_id, warehouse_id, material_id, batch_no);

-- Add check constraint to prevent negative stock
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS chk_quantity_non_negative;
ALTER TABLE inventory ADD CONSTRAINT chk_quantity_non_negative 
    CHECK (
        quantity_on_hand >= 0 
        AND COALESCE(quantity_reserved, 0) >= 0 
        AND COALESCE(quantity_locked, 0) >= 0
    );

-- Optional: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_material_code ON inventory(material_code);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_code ON inventory(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_inventory_contract_code ON inventory(contract_code);
CREATE INDEX IF NOT EXISTS idx_inventory_batch_no ON inventory(batch_no);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_company ON inventory(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_visible ON inventory(visible) WHERE visible = TRUE;
CREATE INDEX IF NOT EXISTS idx_inventory_approved ON inventory(approved) WHERE approved = TRUE;

-- Optional: Add comments to document fields
COMMENT ON COLUMN inventory.contract_id IS 'Reference to contract (no FK constraint)';
COMMENT ON COLUMN inventory.material_code IS 'Denormalized material code for quick access';
COMMENT ON COLUMN inventory.warehouse_code IS 'Denormalized warehouse code for quick access';
COMMENT ON COLUMN inventory.order_to_deduction IS 'Sales order or deduction reference';
COMMENT ON COLUMN inventory.hs_code IS 'Harmonized System code for customs';
COMMENT ON COLUMN inventory.origin_type IS 'e.g. Manufactured, Imported';
COMMENT ON COLUMN inventory.origin_country IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN inventory.quantity_reserved IS 'Reserved quantity (soft lock for pending orders)';
COMMENT ON COLUMN inventory.material_quota IS 'Allocated limit/quota for this material';
COMMENT ON COLUMN inventory.material_quota_percentage IS 'Quota as percentage';

-- ============================================================================
-- END OF ALTER TABLE QUERIES
-- ============================================================================
