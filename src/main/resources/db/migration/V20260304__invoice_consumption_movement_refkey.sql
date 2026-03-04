-- =============================================================================
-- Migration: Invoice + OrderConsumption + inventory_movement.inventory_id
--            + order_header.delivery_date_time
-- Date: 2026-03-04
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. inventory_movement: add inventory_id column
-- -----------------------------------------------------------------------------
ALTER TABLE inventory_movement
    ADD COLUMN IF NOT EXISTS inventory_id UUID NULL;

COMMENT ON COLUMN inventory_movement.inventory_id
    IS 'FK (soft) to inventory.id — the root inventory row this movement originated from';

CREATE INDEX IF NOT EXISTS idx_inv_movement_inventory_id
    ON inventory_movement (inventory_id);

-- -----------------------------------------------------------------------------
-- 2. order_header: add delivery_date_time column + MATERIAL_READY status
-- -----------------------------------------------------------------------------
ALTER TABLE order_header
    ADD COLUMN IF NOT EXISTS delivery_date_time TIMESTAMPTZ NULL;

COMMENT ON COLUMN order_header.delivery_date_time
    IS 'Target delivery date/time set when issuing to production';

-- -----------------------------------------------------------------------------
-- 3. invoice table (PURCHASE / SALE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice (
    id              UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL,
    company_id      UUID         NOT NULL,
    invoice_type    VARCHAR(20)  NOT NULL CHECK (invoice_type IN ('PURCHASE','SALE')),
    invoice_number  VARCHAR(80)  NOT NULL,
    party_id        UUID         NULL,
    party_name      VARCHAR(200) NULL,
    invoice_date    DATE         NULL,
    due_date        DATE         NULL,
    currency        CHAR(3)      NOT NULL DEFAULT 'USD',
    subtotal        NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(18,4) NOT NULL DEFAULT 0,
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','ISSUED','PAID','CANCELLED')),
    notes           TEXT         NULL,
    created_by      VARCHAR(100) NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, company_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoice_tenant_company
    ON invoice (tenant_id, company_id);

CREATE INDEX IF NOT EXISTS idx_invoice_type_status
    ON invoice (invoice_type, status);

COMMENT ON TABLE invoice IS 'Purchasing and selling invoices. Referenced by inventory_movement.reference_id when reference_type = INVOICE';

-- -----------------------------------------------------------------------------
-- 4. order_consumption table
--    Stores per-order estimated material consumption produced during checkInventory.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_consumption (
    id              UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID         NOT NULL,
    material_id     UUID         NOT NULL REFERENCES material(id),
    planned_qty     NUMERIC(14,4) NOT NULL,
    adjusted_qty    NUMERIC(14,4) NOT NULL,
    available_qty   NUMERIC(14,4) NULL,
    check_result    VARCHAR(20)  NULL CHECK (check_result IN ('SUFFICIENT','INSUFFICIENT')),
    tenant_id       UUID         NOT NULL,
    company_id      UUID         NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_consumption_order_id
    ON order_consumption (order_id);

CREATE INDEX IF NOT EXISTS idx_order_consumption_material
    ON order_consumption (material_id);

COMMENT ON TABLE order_consumption
    IS 'Estimated material consumption per order produced by the Check Inventory action (materialQty * materialQuotaPercentage)';

-- =============================================================================
-- View: order_consumption_view — full join for UI management
-- =============================================================================
CREATE OR REPLACE VIEW order_consumption_view AS
SELECT
    oc.id,
    oc.order_id,
    oh.order_number,
    oh.status         AS order_status,
    oh.delivery_date_time,
    oc.material_id,
    m.material_code,
    m.material_name,
    oc.planned_qty,
    oc.adjusted_qty,
    oc.available_qty,
    oc.check_result,
    oc.tenant_id,
    oc.company_id,
    oc.created_at
FROM order_consumption oc
JOIN order_header  oh ON oh.id = oc.order_id
JOIN material       m ON m.id  = oc.material_id;

COMMENT ON VIEW order_consumption_view
    IS 'Full consumption view joining order_consumption → order_header → material';
