-- =========================================
-- Enable UUID generation
-- =========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- 1. MASTER DATA
-- =========================================

-- ---------- Material ----------
CREATE TABLE material (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_code   VARCHAR(50) UNIQUE NOT NULL,
    material_name   TEXT NOT NULL,
    unit            VARCHAR(20) NOT NULL,      -- PCS, KG, M
    material_type   VARCHAR(30) NOT NULL,      -- RAW, SEMI, FINISHED
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT now()
);

-- ---------- Model ----------
CREATE TABLE model (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_code      VARCHAR(50) UNIQUE NOT NULL,
    model_name      TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT now()
);

-- ---------- Supplier ----------
CREATE TABLE supplier (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50) UNIQUE,
    supplier_code   VARCHAR(50) UNIQUE NOT NULL,
    supplier_name   TEXT NOT NULL,
    contact_name    VARCHAR(100),
    phone           VARCHAR(30),
    email           VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT now()
);

-- ---------- Warehouse ----------
CREATE TABLE warehouse (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code    VARCHAR(50) UNIQUE NOT NULL,
    name    TEXT NOT NULL
);

-- =========================================
-- 2. BOM STRUCTURE
-- =========================================

-- ---------- BOM Header ----------
CREATE TABLE bom (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name  VARCHAR(100) NOT NULL,
    version     INTEGER NOT NULL,
    status      VARCHAR(20) NOT NULL,           -- DRAFT, ACTIVE, ARCHIVED
    created_at  TIMESTAMP DEFAULT now(),
    UNIQUE (model_name, version)
);

-- ---------- BOM Items (Tree Structure) ----------
CREATE TABLE bom_item (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bom_id          UUID NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
    parent_item_id  UUID REFERENCES bom_item(id),
    material_id     UUID NOT NULL REFERENCES material(id),
    quantity        NUMERIC(12,4) NOT NULL,
    level           INTEGER NOT NULL
);

-- ---------- Model BOM (Material consumption per Model unit) ----------
-- Links a Model to a Material with the quantity required per one Model unit.
CREATE TABLE model_bom (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id        UUID NOT NULL REFERENCES model(id) ON DELETE CASCADE,
    material_id     UUID NOT NULL REFERENCES material(id) ON DELETE RESTRICT,
    qty_per_unit    NUMERIC(14,4) NOT NULL
);

-- =========================================
-- 3. INVENTORY CORE
-- =========================================

-- ---------- Inventory Balance ----------
CREATE TABLE inventory (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id         UUID NOT NULL REFERENCES material(id),
    warehouse_id        UUID NOT NULL REFERENCES warehouse(id),
    quantity_on_hand    NUMERIC(14,4) NOT NULL,
    quantity_locked     NUMERIC(14,4) DEFAULT 0,
    updated_at          TIMESTAMP DEFAULT now(),
    UNIQUE (material_id, warehouse_id)
);

-- =========================================
-- 4. LOCKING MECHANISM
-- =========================================

-- ---------- Inventory Lock ----------
CREATE TABLE inventory_lock (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id     UUID NOT NULL REFERENCES material(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouse(id),
    lock_type       VARCHAR(30) NOT NULL,       -- BOM_ALLOCATION, DEFECTIVE, SUPPLIER_HOLD
    quantity        NUMERIC(14,4) NOT NULL,
    reference_type  VARCHAR(50),                -- BOM_TASK, DEFECT, SUPPLIER
    reference_id    UUID,
    status          VARCHAR(20) NOT NULL,       -- ACTIVE, RELEASED
    created_at      TIMESTAMP DEFAULT now()
);

-- =========================================
-- 5. DEFECTIVE MATERIAL HANDLING
-- =========================================

-- ---------- Material Defect ----------
CREATE TABLE material_defect (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id     UUID NOT NULL REFERENCES material(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouse(id),
    quantity        NUMERIC(14,4) NOT NULL,
    defect_reason   TEXT,
    status          VARCHAR(20) NOT NULL,       -- OPEN, SCRAPPED, RETURNED
    created_at      TIMESTAMP DEFAULT now()
);

-- =========================================
-- 6. SUPPLIER ISSUES
-- =========================================

-- ---------- Supplier Issue ----------
CREATE TABLE supplier_issue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID NOT NULL REFERENCES supplier(id),
    material_id     UUID NOT NULL REFERENCES material(id),
    quantity        NUMERIC(14,4),
    issue_type      VARCHAR(30) NOT NULL,       -- DELAY, QUALITY, SHORTAGE
    status          VARCHAR(20) NOT NULL,       -- OPEN, RESOLVED
    created_at      TIMESTAMP DEFAULT now()
);

-- =========================================
-- 7. BOM CALCULATION ENGINE
-- =========================================

-- ---------- BOM Calculation Task ----------
CREATE TABLE bom_calculation (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bom_id      UUID NOT NULL REFERENCES bom(id),
    model_name  VARCHAR(100) NOT NULL,
    target_qty  NUMERIC(14,4) NOT NULL,
    status      VARCHAR(20) NOT NULL,           -- CREATED, PROCESSING, SUCCESS, FAILED
    created_at  TIMESTAMP DEFAULT now()
);

-- ---------- BOM Calculation Result ----------
CREATE TABLE bom_calculation_item (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calculation_id  UUID NOT NULL REFERENCES bom_calculation(id) ON DELETE CASCADE,
    material_id     UUID NOT NULL REFERENCES material(id),
    required_qty    NUMERIC(14,4) NOT NULL,
    available_qty   NUMERIC(14,4) NOT NULL,
    shortage_qty    NUMERIC(14,4) NOT NULL
);

-- =========================================
-- 8. FORECASTING & HISTORY
-- =========================================

-- ---------- Inventory History (Snapshots) ----------
CREATE TABLE inventory_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id     UUID NOT NULL REFERENCES material(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouse(id),
    quantity        NUMERIC(14,4) NOT NULL,
    snapshot_date   DATE NOT NULL
);

-- ---------- Material Consumption ----------
CREATE TABLE material_consumption (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id     UUID NOT NULL REFERENCES material(id),
    quantity        NUMERIC(14,4) NOT NULL,
    source          VARCHAR(30) NOT NULL,       -- BOM, SCRAP, ADJUSTMENT
    consumed_at     DATE NOT NULL
);

-- ---------- Material Forecast ----------
CREATE TABLE material_forecast (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id     UUID NOT NULL REFERENCES material(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouse(id),
    forecast_date   DATE NOT NULL,
    forecast_qty    NUMERIC(14,4) NOT NULL,
    model_version   VARCHAR(20)
);