-- NNC Minh Châu shop clone seed for the current BOM/shop schema.
-- Source snapshot: local PostgreSQL database nncminhchau, public.inventory_movement,
-- inspected 2026-10-22. Legacy modeltb and materialtb contained no rows.
-- 16 distinct mtlviname values become models/materials. Opening quantity is
-- GREATEST(0, SUM(IN quantity) - SUM(OUT quantity)) per exact item name.
-- Source mtlcode is always 'none', so this seed assigns stable NNC-001..016 codes.
-- Prices are the latest nonzero source unitprice per exact name, used as sample
-- selling prices. Source currency was 'none'; VND is assumed. Verify prices
-- and stock against the physical inventory before using this shop for sales.
-- Run after the BOM/shop/auth migrations on the target app database.
-- Rerunnable: existing stock quantities are preserved on subsequent runs.
-- Admin login: nncminhchau (password supplied separately; stored here as BCrypt).

BEGIN;

CREATE TEMP TABLE nncminhchau_seed_catalog (
    code text PRIMARY KEY,
    name text NOT NULL,
    sample_price numeric NOT NULL,
    opening_qty numeric NOT NULL
) ON COMMIT DROP;

INSERT INTO nncminhchau_seed_catalog (code, name, sample_price, opening_qty)
VALUES
    ('NNC-001', 'Động cơ Cummin 10C đã qua sử dụng', 20000000, 2),
    ('NNC-002', 'Động cơ Diesel L11 xe đào đã qua sử dụng', 11500000, 0),
    ('NNC-003', 'Động cơ máy thủy Diesel ISUZU ( Hàng đã qua sử dụng )', 10000000, 0),
    ('NNC-004', 'Động cơ máy thủy Diesel KOMATSU ( Hàng đã qua sử dụng )', 9500000, 0),
    ('NNC-005', 'Động cơ máy thủy Diesel MITSUBISHI ( Hàng đã qua sử dụng )', 10000000, 0),
    ('NNC-006', 'Động cơ máy thủy Diesel YAMAHA công suất 230PS ( Hàng đã qua sử dụng )', 11000000, 0),
    ('NNC-007', 'Động cơ máy thủy Diesel YANMAR ( Hàng đã qua sử dụng )', 10000000, 0),
    ('NNC-008', 'Động Cơ máy thuỷ Yanmar 250hp đã qua sử dụng', 11500000, 0),
    ('NNC-009', 'Động cơ thuỷ Isuzu đã qua sử dụng', 50000000, 1),
    ('NNC-010', 'MÁY THUỶ ĐÃ QUASỬ DỤNG HIỆU MITSUBISHI.YAMAHA.KOMATSU.ISUZU', 9000000, 25),
    ('NNC-011', 'MÁY THUỶ ĐÃ QUA SỬ DỤNG HIỆU MITSUBISHI.YAMAHA.YANMAR', 6000000, 30),
    ('NNC-012', 'MÁY THUỶ ĐÃ QUA SỬ DỤNG HIÊU MITSUBISHI.YAMAHA.YANMAR.ISUZU', 7000000, 40),
    ('NNC-013', 'MÁY THUỶ ĐÃ QUA SỬ DỤNG HIỆU MITSUBISHI.YAMAHA.YANMAR,ISUZU', 6000000, 64),
    ('NNC-014', 'MÁY THUỶ ĐÃ QUA SỬ DỤNG HIỆU MITSUBISHI.YAMAHA.YANMAR.ISUZU', 11500000, 16),
    ('NNC-015', 'MÁY THUỶ ĐÃ QUA SỬ DỤNG HIỆU YANMAR.ISUZU.KOMATSU.MITSUBISHI', 17000000, 26),
    ('NNC-016', 'MÁY THUỶ ĐÃ QUA SỬ DỤNG HIỆU YANMAR.YAMAHA.MITSUBISHI.ISUZU', 8500000, 27);

INSERT INTO tenant (id, created_at, tenant_code, tenant_name, tenant_type, is_active)
VALUES (md5('nncminhchau:tenant')::uuid, NOW(),
        'nncminhchau.vn', 'NNC Minh Châu', 'SHOP', TRUE)
ON CONFLICT (tenant_code) DO UPDATE SET
    tenant_name = EXCLUDED.tenant_name,
    tenant_type = 'SHOP',
    is_active = TRUE;

INSERT INTO company (
    id, company_code, company_name, created_at, tenant_id,
    last_order_number, prepaid_menu, realtime_inventory,
    shop_processing_inventory_recheck, shop_name
)
VALUES (
    md5('nncminhchau:company')::uuid, 'NNCMINHCHAU', 'NNC Minh Châu',
    NOW(), (SELECT id FROM tenant WHERE tenant_code = 'nncminhchau.vn'),
    0, FALSE, TRUE, TRUE, 'NNC Minh Châu'
)
ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    tenant_id = EXCLUDED.tenant_id,
    realtime_inventory = TRUE,
    shop_processing_inventory_recheck = TRUE,
    shop_name = EXCLUDED.shop_name;

INSERT INTO warehouse (id, tenant_id, company_id, code, name, is_active, created_at, note)
VALUES (
    md5('nncminhchau:warehouse:main')::uuid,
    (SELECT id FROM tenant WHERE tenant_code = 'nncminhchau.vn'),
    md5('nncminhchau:company')::uuid,
    'NNC-MAIN', 'Kho NNC Minh Châu', TRUE, NOW(),
    'Opening stock from legacy nncminhchau.inventory_movement snapshot'
)
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    company_id = EXCLUDED.company_id,
    is_active = TRUE;

INSERT INTO shop_table (id, tenant_id, company_id, table_name, is_active, created_at)
VALUES (
    md5('nncminhchau:table:counter')::uuid,
    (SELECT id FROM tenant WHERE tenant_code = 'nncminhchau.vn'),
    md5('nncminhchau:company')::uuid,
    'Quầy bán hàng', TRUE, NOW()
)
ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

INSERT INTO model (
    id, model_code, model_name, is_active, created_at,
    tenant_id, company_id, selling_price, category
)
SELECT
    md5('nncminhchau:model:' || c.code)::uuid,
    c.code, c.name, TRUE, NOW(),
    t.id, md5('nncminhchau:company')::uuid,
    c.sample_price, 'Động cơ đã qua sử dụng'
FROM nncminhchau_seed_catalog c
CROSS JOIN (SELECT id FROM tenant WHERE tenant_code = 'nncminhchau.vn') t
ON CONFLICT (id) DO NOTHING;

INSERT INTO material (
    id, tenant_id, company_id, material_code, material_name,
    unit, material_type, price, is_active, created_at,
    inventory_alert_enabled, inventory_alert_quantity, description
)
SELECT
    md5('nncminhchau:material:' || c.code)::uuid,
    t.id, md5('nncminhchau:company')::uuid,
    'MAT-' || c.code, c.name,
    'cái', 'FINISHED_GOOD', c.sample_price, TRUE, NOW(),
    TRUE, 1, 'Imported example from legacy inventory_movement'
FROM nncminhchau_seed_catalog c
CROSS JOIN (SELECT id FROM tenant WHERE tenant_code = 'nncminhchau.vn') t
ON CONFLICT (id) DO NOTHING;

INSERT INTO bom (id, bom_name, version, status, created_at, tenant_id, model_id, company_id)
SELECT
    md5('nncminhchau:bom:' || c.code)::uuid,
    c.name || ' BOM', 1, 'ACTIVE', NOW(), t.id,
    md5('nncminhchau:model:' || c.code)::uuid,
    md5('nncminhchau:company')::uuid
FROM nncminhchau_seed_catalog c
CROSS JOIN (SELECT id FROM tenant WHERE tenant_code = 'nncminhchau.vn') t
ON CONFLICT (tenant_id, model_id, version) DO NOTHING;

INSERT INTO model_bom (
    id, tenant_id, company_id, model_id, material_id,
    qty_per_unit, warehouse_qty, warehouse_unit, bom_unit_per_warehouse_unit
)
SELECT
    md5('nncminhchau:model-bom:' || c.code)::uuid,
    t.id, md5('nncminhchau:company')::uuid,
    md5('nncminhchau:model:' || c.code)::uuid,
    md5('nncminhchau:material:' || c.code)::uuid,
    1, 1, 'cái', 1
FROM nncminhchau_seed_catalog c
CROSS JOIN (SELECT id FROM tenant WHERE tenant_code = 'nncminhchau.vn') t
ON CONFLICT (id) DO NOTHING;

INSERT INTO bom_item (
    id, tenant_id, company_id, bom_id, parent_item_id,
    material_id, quantity, level, created_at
)
SELECT
    md5('nncminhchau:bom-item:' || c.code)::uuid,
    t.id, md5('nncminhchau:company')::uuid,
    md5('nncminhchau:bom:' || c.code)::uuid, NULL,
    md5('nncminhchau:material:' || c.code)::uuid,
    1, 0, NOW()
FROM nncminhchau_seed_catalog c
CROSS JOIN (SELECT id FROM tenant WHERE tenant_code = 'nncminhchau.vn') t
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory (
    id, tenant_id, company_id, material_id, warehouse_id,
    material_code, warehouse_code, batch_no, user_name,
    unit, unit_price, warehouse_import_unit, warehouse_import_quantity,
    bom_unit_per_warehouse_unit, warehouse_import_unit_price,
    currency, quantity_on_hand, quantity_total,
    quantity_reserved, quantity_locked, visible, approved, locked, created_at
)
SELECT
    md5('nncminhchau:inventory:opening:' || c.code)::uuid,
    t.id, md5('nncminhchau:company')::uuid,
    md5('nncminhchau:material:' || c.code)::uuid,
    md5('nncminhchau:warehouse:main')::uuid,
    'MAT-' || c.code, 'NNC-MAIN', 'LEGACY-OPENING-' || c.code,
    'nncminhchau-seed', 'cái', c.sample_price,
    'cái', c.opening_qty, 1, c.sample_price,
    'VND', c.opening_qty, c.opening_qty,
    0, 0, TRUE, TRUE, FALSE, NOW()
FROM nncminhchau_seed_catalog c
CROSS JOIN (SELECT id FROM tenant WHERE tenant_code = 'nncminhchau.vn') t
ON CONFLICT (id) DO NOTHING;

-- Current auth scoping columns used by the shop UI.
ALTER TABLE usertb
    ADD COLUMN IF NOT EXISTS lasttenantid varchar(36),
    ADD COLUMN IF NOT EXISTS lastcompanyid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedtenantid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedcompanyid varchar(36);

INSERT INTO usertb (
    username, password, firstname, lastname, email,
    isaccountnonexpired, isaccountnonlocked, iscredentialsnonexpired,
    isallowmarketing, isenabled, createdtime, validationcode, leaderid,
    lasttenantid, lastcompanyid, assignedtenantid, assignedcompanyid
)
VALUES (
    'nncminhchau',
    '$2b$12$yGo8jtnxGyxGGj1MsIwvteOL899pZJNIUYVc0quVyJW5G6m4tgMMW',
    'NNC', 'Minh Châu', 'admin@nncminhchau.vn',
    TRUE, TRUE, TRUE, FALSE, TRUE, NOW(), '', 0,
    (SELECT id::text FROM tenant WHERE tenant_code = 'nncminhchau.vn'),
    md5('nncminhchau:company')::uuid::text,
    (SELECT id::text FROM tenant WHERE tenant_code = 'nncminhchau.vn'),
    md5('nncminhchau:company')::uuid::text
)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    firstname = EXCLUDED.firstname,
    lastname = EXCLUDED.lastname,
    email = EXCLUDED.email,
    isaccountnonexpired = TRUE,
    isaccountnonlocked = TRUE,
    iscredentialsnonexpired = TRUE,
    isenabled = TRUE,
    lasttenantid = EXCLUDED.lasttenantid,
    lastcompanyid = EXCLUDED.lastcompanyid,
    assignedtenantid = EXCLUDED.assignedtenantid,
    assignedcompanyid = EXCLUDED.assignedcompanyid;

INSERT INTO authorities (username, authority, description, visible)
SELECT 'nncminhchau', 'ROLE_ADMIN', 'NNC Minh Châu shop administrator', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM authorities
    WHERE username = 'nncminhchau' AND authority = 'ROLE_ADMIN'
);

COMMIT;

