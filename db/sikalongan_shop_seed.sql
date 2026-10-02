-- Sika Long An / Công ty TNHH MTV TM DV Huỳnh Toàn shop seed.
-- PostgreSQL UTF-8; rerunnable after the BOM/shop/auth migrations.
-- Catalog and image sources checked from https://sikalongan.com/ on 2026-10-02.
-- The source website publishes every item with price "Liên hệ". Therefore this
-- seed uses selling_price = 0; replace it with the current quotation before sale.
-- Login: sikalongan / sikalongan
-- Public ordering URL after deployment:
--   https://YOUR_HOST/bom-inventory/shop/menu?t=sikalongan-menu-2026

BEGIN;

INSERT INTO tenant (id, created_at, tenant_code, tenant_name, tenant_type, is_active)
VALUES (
    md5('sikalongan:tenant')::uuid, NOW(),
    'sikalongan.com', 'Sika Long An - Huỳnh Toàn', 'SHOP', TRUE
)
ON CONFLICT (tenant_code) DO UPDATE SET
    tenant_name=EXCLUDED.tenant_name,
    tenant_type='SHOP',
    is_active=TRUE;

INSERT INTO company (
    id, company_code, company_name, created_at, tenant_id,
    bank_bin, bank_account_number, bank_account_name,
    last_order_number, prepaid_menu, realtime_inventory,
    shop_processing_inventory_recheck,
    shop_name, shop_address, address, shop_phone, phone_number
)
VALUES (
    md5('sikalongan:company')::uuid,
    'SIKALONGAN',
    'Công ty TNHH MTV TM DV Huỳnh Toàn',
    NOW(),
    (SELECT id FROM tenant WHERE tenant_code='sikalongan.com'),
    NULL, NULL, NULL,
    0, FALSE, TRUE, TRUE,
    'Sika Long An - Huỳnh Toàn',
    'Tân An, Long An',
    'Tân An, Long An',
    NULL, NULL
)
ON CONFLICT (id) DO UPDATE SET
    company_code=EXCLUDED.company_code,
    company_name=EXCLUDED.company_name,
    tenant_id=EXCLUDED.tenant_id,
    realtime_inventory=TRUE,
    shop_processing_inventory_recheck=TRUE,
    shop_name=EXCLUDED.shop_name,
    shop_address=EXCLUDED.shop_address,
    address=EXCLUDED.address;

-- One warehouse backs both the catalog and counter inventory.
INSERT INTO warehouse (
    id, tenant_id, company_id, code, name, location,
    is_active, created_at, note
)
VALUES (
    md5('sikalongan:warehouse:main')::uuid,
    (SELECT id FROM tenant WHERE tenant_code='sikalongan.com'),
    md5('sikalongan:company')::uuid,
    'SIKALA-MAIN', 'Kho Sika Long An', 'Tân An, Long An',
    TRUE, NOW(), 'Sample opening inventory created by sikalongan_shop_seed.sql'
)
ON CONFLICT (id) DO UPDATE SET
    tenant_id=EXCLUDED.tenant_id,
    company_id=EXCLUDED.company_id,
    code=EXCLUDED.code,
    name=EXCLUDED.name,
    location=EXCLUDED.location,
    is_active=TRUE,
    note=EXCLUDED.note;

-- A retail counter is enough for POS orders; pickup/delivery remain fulfillment
-- types and do not need fake table records.
INSERT INTO shop_table (id, tenant_id, company_id, table_name, is_active, created_at)
VALUES (
    md5('sikalongan:table:counter')::uuid,
    (SELECT id FROM tenant WHERE tenant_code='sikalongan.com'),
    md5('sikalongan:company')::uuid,
    'Quầy bán hàng', TRUE, NOW()
)
ON CONFLICT (id) DO UPDATE SET
    tenant_id=EXCLUDED.tenant_id,
    company_id=EXCLUDED.company_id,
    table_name=EXCLUDED.table_name,
    is_active=TRUE;

-- Customer ordering hours: one daily shift, 08:00 through 17:00, every day.
-- This seed owns the new shop's schedule, so remove any conflicting hours first.
DELETE FROM shop_shift
WHERE tenant_id=(SELECT id FROM tenant WHERE tenant_code='sikalongan.com')
  AND company_id=md5('sikalongan:company')::uuid;

INSERT INTO shop_shift (
    id, tenant_id, company_id, day_of_week,
    start_time, end_time, label, is_active, created_at
)
SELECT
    md5('sikalongan:shop-shift:' || day_no::text)::uuid,
    (SELECT id FROM tenant WHERE tenant_code='sikalongan.com'),
    md5('sikalongan:company')::uuid,
    day_no, TIME '08:00', TIME '17:00', 'Ca 08:00–17:00', TRUE, NOW()
FROM generate_series(1, 7) AS day_no;

-- Retire earlier rows owned by this seed before applying the current web catalog.
UPDATE model
SET is_active=FALSE
WHERE tenant_id=(SELECT id FROM tenant WHERE tenant_code='sikalongan.com')
  AND company_id=md5('sikalongan:company')::uuid
  AND model_code LIKE 'SIKALA-%';

-- The website lists some products in more than one section. Each unique product
-- appears once here so it cannot accidentally be added to an order twice.
WITH catalog(ordinal, model_code, model_name, category, image_url) AS (
VALUES
    (1,  'SIKALA-WP-KANSHIELD-MAX',       'Chống thấm pha màu nội thất Kanshield Max',           'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2023/09/kanshield-max-1-300x300.jpg'),
    (2,  'SIKALA-WP-KANSHIELD-PLUS',      'Chống thấm pha màu ngoại thất Kanshield Plus',         'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2023/09/kanshield-plus-300x300.jpg'),
    (3,  'SIKALA-WP-SIKATOP-109',         'SikaTop 109 Seal VN',                                  'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/09/02-en_vi-sikatop-109-seal-vn-1x1_hybrisProductImages-300x300.webp'),
    (4,  'SIKALA-WP-MONOTOP-166',         'Sika MonoTop 166 Migrating',                            'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/09/02-en_vi-sika-monotop-166-migrating-1x1_hybrisProductImages-300x300.webp'),
    (5,  'SIKALA-WP-SIKALASTIC-632R',     'Sikalastic 632 R',                                     'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/09/02%E2%80%90en_VNSikalastic-632R-1x1_hybrisProductImages-300x300.webp'),
    (6,  'SIKALA-WP-SIKALASTIC-590',      'Sikalastic 590',                                       'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/09/02%E2%80%90en_VNSikalastic-590-1x1_hybrisProductImages-300x300.webp'),
    (7,  'SIKALA-WP-SIKALASTIC-110',      'Sikalastic 110',                                       'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/09/02%E2%80%90en_VNSikalastic-110-1x1_hybrisProductImages-300x300.webp'),
    (8,  'SIKALA-WP-SIKACOAT-PLUS',       'SikaCoat Plus',                                        'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/09/02-en-vn-sika-coat-plus-2000x2000_hybrisProductImages-300x300.webp'),
    (9,  'SIKALA-WP-WATERBAR-V20',        'Sika Waterbar V20 Eco',                                'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/09/sikawaterbar-2113-300x300.jpg'),
    (10, 'SIKALA-WP-SEPAROL-25L',         'Separol 25L',                                          'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/09/separol25l-5157-300x300.jpg'),
    (11, 'SIKALA-WP-SIKADUR-20-AB',       'Sikadur 20 Crack Seal A/B',                            'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/08/sikadur20crackseal-3502-300x300.jpg'),
    (12, 'SIKALA-WP-SIKAFLEX-CONSTR',     'Sikaflex Construction J/G',                            'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/08/sikaflexconstruction-9789-300x300.jpg'),
    (13, 'SIKALA-WP-TILEBOND-GP-25',      'Sika Tilebond GP 25kg',                                'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/08/sikatilebondgp-3442-300x300.jpg'),
    (14, 'SIKALA-WP-SIKALASTIC-590-20',   'Sikalastic 590 20kg',                                  'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/08/sikalastic590-4366-300x300.jpg'),
    (15, 'SIKALA-WP-SIKADUR-731',         'Sikadur 731',                                          'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/08/sika731-9721-300x300.jpg'),
    (16, 'SIKALA-WP-SIKATOP-SEAL-107',    'SikaTop Seal 107',                                     'VẬT LIỆU CHỐNG THẤM', 'https://sikalongan.com/wp-content/uploads/2022/08/sikatopseal107-3400-300x300.jpg'),

    (17, 'SIKALA-PAINT-CURVED',           'Sơn lót chống kiềm cao cấp Kanshield Curved',          'SƠN KANSHIELD', 'https://sikalongan.com/wp-content/uploads/2023/09/kanshield-curved-1-300x300.jpg'),
    (18, 'SIKALA-PAINT-PUTTY-INDOOR',     'Bột trét tường trong nhà Kanshield',                    'SƠN KANSHIELD', 'https://sikalongan.com/wp-content/uploads/2023/08/bot-tret-tuong-300x300.jpg'),
    (19, 'SIKALA-PAINT-PUTTY-OUTDOOR',    'Bột trét cao cấp ngoại thất Kanshield',                 'SƠN KANSHIELD', 'https://sikalongan.com/wp-content/uploads/2023/08/bot-tret-cao-cap-300x300.jpg'),
    (20, 'SIKALA-PAINT-KS9999',           'Sơn chống thấm Kanshield KS9999',                       'SƠN KANSHIELD', 'https://sikalongan.com/wp-content/uploads/2023/08/ks9999-1-300x300.png'),
    (21, 'SIKALA-PAINT-KS3333',           'Bột trét cao cấp Kanshield KS3333',                     'SƠN KANSHIELD', 'https://sikalongan.com/wp-content/uploads/2023/08/ks3333-300x300.png'),
    (22, 'SIKALA-PAINT-KS2222',           'Sơn nước ngoại thất cao cấp Kanshield KS2222',          'SƠN KANSHIELD', 'https://sikalongan.com/wp-content/uploads/2023/08/kanshiel-2222-300x300.jpg'),
    (23, 'SIKALA-PAINT-KS1111',           'Kanshield KS1111',                                     'SƠN KANSHIELD', 'https://sikalongan.com/wp-content/uploads/2023/08/kanshiel-111-300x300.jpg'),
    (24, 'SIKALA-PAINT-KS6666',           'Sơn nội thất cao cấp Kanshield KS6666',                 'SƠN KANSHIELD', 'https://sikalongan.com/wp-content/uploads/2022/09/sonnoithatcaocapkanshieldks6666-6825-300x300.jpg'),
    (25, 'SIKALA-PAINT-KS8888-5L',        'Sơn bóng cao cấp Kanshield KS8888 5L',                  'SƠN KANSHIELD', 'https://sikalongan.com/wp-content/uploads/2022/09/sonbongcaocapkanshieldks8888mau1-3183-300x300.jpg'),

    (26, 'SIKALA-GROUT-212-11',           'SikaGrout 212-11',                                     'VỮA RÓT – ĐỊNH VỊ', 'https://sikalongan.com/wp-content/uploads/2022/09/SIKAGROUT-212-11-300x300.jpg'),
    (27, 'SIKALA-GROUT-SIKADUR-42MP',     'Sikadur 42 MP',                                        'VỮA RÓT – ĐỊNH VỊ', 'https://sikalongan.com/wp-content/uploads/2022/09/sikadur42MPchat-ketdinhgocnhuaepoxytusanphang-300x300.jpg'),
    (28, 'SIKALA-GROUT-214-11-HS',        'SikaGrout 214-11 HS',                                  'VỮA RÓT – ĐỊNH VỊ', 'https://sikalongan.com/wp-content/uploads/2022/09/SikaGrout-214-11-Hs-vua-khong-co-ngot-80Mpa-300x300.jpeg'),
    (29, 'SIKALA-GROUT-214-11',           'SikaGrout 214-11',                                     'VỮA RÓT – ĐỊNH VỊ', 'https://sikalongan.com/wp-content/uploads/2022/09/02%E2%80%90en_VN-SikaGrout-214-11-1x1-Copy_hybrisProductImages-300x300.webp'),
    (30, 'SIKALA-GROUT-GP',               'SikaGrout GP',                                         'VỮA RÓT – ĐỊNH VỊ', 'https://sikalongan.com/wp-content/uploads/2022/09/02%E2%80%90en_VN-SikaGrout%C2%AE-GP-1x1_hybrisProductImages-300x300.webp'),

    (31, 'SIKALA-BOND-SIKADUR-732',       'Sikadur 732',                                          'CHẤT KẾT DÍNH CƯỜNG ĐỘ CAO', 'https://sikalongan.com/wp-content/uploads/2022/09/sika7-300x300.jpg'),
    (32, 'SIKALA-BOND-SIKADUR-752',       'Sikadur 752',                                          'CHẤT KẾT DÍNH CƯỜNG ĐỘ CAO', 'https://sikalongan.com/wp-content/uploads/2022/09/sika6-300x300.jpg'),
    (33, 'SIKALA-BOND-ANCHORFIX-3001',    'Sika AnchorFix 3001',                                  'CHẤT KẾT DÍNH CƯỜNG ĐỘ CAO', 'https://sikalongan.com/wp-content/uploads/2022/09/sika2-300x300.jpg'),
    (34, 'SIKALA-BOND-ANCHORFIX-S',       'Sika AnchorFix S',                                     'CHẤT KẾT DÍNH CƯỜNG ĐỘ CAO', 'https://sikalongan.com/wp-content/uploads/2022/09/sika1-300x300.jpg')
)
INSERT INTO model (
    id, model_code, model_name, is_active, created_at, tenant_id, company_id,
    selling_price, category, image_url
)
SELECT
    md5('sikalongan:model:' || model_code)::uuid,
    model_code, model_name, TRUE, NOW(),
    (SELECT id FROM tenant WHERE tenant_code='sikalongan.com'),
    md5('sikalongan:company')::uuid,
    0, category, image_url
FROM catalog
ON CONFLICT (id) DO UPDATE SET
    model_code=EXCLUDED.model_code,
    model_name=EXCLUDED.model_name,
    is_active=TRUE,
    tenant_id=EXCLUDED.tenant_id,
    company_id=EXCLUDED.company_id,
    selling_price=EXCLUDED.selling_price,
    category=EXCLUDED.category,
    image_url=EXCLUDED.image_url;

-- Active BOM headers for every sellable catalog product.
INSERT INTO bom (id, bom_name, version, status, created_at, tenant_id, model_id, company_id)
SELECT
    md5('sikalongan:bom:' || m.model_code)::uuid,
    m.model_name || ' BOM', 1, 'ACTIVE', NOW(),
    m.tenant_id, m.id, m.company_id
FROM model m
WHERE m.tenant_id=(SELECT id FROM tenant WHERE tenant_code='sikalongan.com')
  AND m.company_id=md5('sikalongan:company')::uuid
  AND m.model_code LIKE 'SIKALA-%'
ON CONFLICT (tenant_id, model_id, version) DO UPDATE SET
    bom_name=EXCLUDED.bom_name,
    status='ACTIVE';

-- Each retail menu product maps one-to-one to an inventory material. The same
-- unit is used throughout Material -> Model BOM -> Inventory, so selling one
-- product deducts exactly one "Sản phẩm" from stock.
INSERT INTO material (
    id, tenant_id, company_id, material_code, material_name,
    unit, material_type, thumbnail_url, price,
    inventory_alert_enabled, inventory_alert_quantity,
    description, is_active, created_at, manual_shift_consumption
)
SELECT
    md5('sikalongan:material:' || m.model_code)::uuid,
    m.tenant_id, m.company_id,
    'MAT-' || m.model_code,
    m.model_name,
    'Sản phẩm', 'FINISHED_GOOD', m.image_url, m.selling_price,
    TRUE, 10,
    'Hàng bán lẻ liên kết trực tiếp với menu ' || m.model_code,
    TRUE, NOW(), FALSE
FROM model m
WHERE m.tenant_id=(SELECT id FROM tenant WHERE tenant_code='sikalongan.com')
  AND m.company_id=md5('sikalongan:company')::uuid
  AND m.model_code LIKE 'SIKALA-%'
ON CONFLICT (id) DO UPDATE SET
    tenant_id=EXCLUDED.tenant_id,
    company_id=EXCLUDED.company_id,
    material_code=EXCLUDED.material_code,
    material_name=EXCLUDED.material_name,
    unit=EXCLUDED.unit,
    material_type=EXCLUDED.material_type,
    thumbnail_url=EXCLUDED.thumbnail_url,
    price=EXCLUDED.price,
    inventory_alert_enabled=TRUE,
    inventory_alert_quantity=EXCLUDED.inventory_alert_quantity,
    description=EXCLUDED.description,
    is_active=TRUE;

INSERT INTO model_bom (
    id, tenant_id, company_id, model_id, material_id,
    qty_per_unit, warehouse_qty, warehouse_unit,
    bom_unit_per_warehouse_unit
)
SELECT
    md5('sikalongan:model-bom:' || m.model_code)::uuid,
    m.tenant_id, m.company_id, m.id,
    md5('sikalongan:material:' || m.model_code)::uuid,
    1, 1, 'Sản phẩm', 1
FROM model m
WHERE m.tenant_id=(SELECT id FROM tenant WHERE tenant_code='sikalongan.com')
  AND m.company_id=md5('sikalongan:company')::uuid
  AND m.model_code LIKE 'SIKALA-%'
ON CONFLICT (id) DO UPDATE SET
    tenant_id=EXCLUDED.tenant_id,
    company_id=EXCLUDED.company_id,
    model_id=EXCLUDED.model_id,
    material_id=EXCLUDED.material_id,
    qty_per_unit=1,
    warehouse_qty=1,
    warehouse_unit='Sản phẩm',
    bom_unit_per_warehouse_unit=1;

-- Shop order availability/audit resolves the active BOM through bom_item. Keep
-- this one-unit leaf in sync with model_bom so counter confirmation deducts the
-- same finished-good material shown on the menu.
INSERT INTO bom_item (
    id, tenant_id, company_id, bom_id, parent_item_id,
    material_id, quantity, level, created_at
)
SELECT
    md5('sikalongan:bom-item:' || m.model_code)::uuid,
    m.tenant_id, m.company_id, b.id, NULL,
    md5('sikalongan:material:' || m.model_code)::uuid,
    1, 0, NOW()
FROM model m
JOIN bom b
  ON b.tenant_id=m.tenant_id
 AND b.company_id=m.company_id
 AND b.model_id=m.id
 AND b.version=1
WHERE m.tenant_id=(SELECT id FROM tenant WHERE tenant_code='sikalongan.com')
  AND m.company_id=md5('sikalongan:company')::uuid
  AND m.model_code LIKE 'SIKALA-%'
ON CONFLICT (id) DO UPDATE SET
    tenant_id=EXCLUDED.tenant_id,
    company_id=EXCLUDED.company_id,
    bom_id=EXCLUDED.bom_id,
    parent_item_id=NULL,
    material_id=EXCLUDED.material_id,
    quantity=1,
    level=0;

-- Sample opening stock: 100 units of every listed product. ON CONFLICT does not
-- reset quantities, so rerunning the seed cannot restore stock already sold.
INSERT INTO inventory (
    id, tenant_id, company_id, material_id, warehouse_id,
    material_code, warehouse_code, batch_no, user_name,
    unit, unit_price, currency,
    quantity_on_hand, quantity_total, quantity_reserved, quantity_locked,
    visible, approved, locked, created_at
)
SELECT
    md5('sikalongan:inventory:opening:' || m.model_code)::uuid,
    m.tenant_id, m.company_id,
    md5('sikalongan:material:' || m.model_code)::uuid,
    md5('sikalongan:warehouse:main')::uuid,
    'MAT-' || m.model_code, 'SIKALA-MAIN', 'SEED-OPENING-2026',
    'sikalongan-seed', 'Sản phẩm', 0, 'VND',
    100, 100, 0, 0, TRUE, TRUE, FALSE, NOW()
FROM model m
WHERE m.tenant_id=(SELECT id FROM tenant WHERE tenant_code='sikalongan.com')
  AND m.company_id=md5('sikalongan:company')::uuid
  AND m.model_code LIKE 'SIKALA-%'
ON CONFLICT (id) DO NOTHING;

-- A sample monthly quota mirrors the opening quantity. Consumed amounts survive
-- reruns; only an allocation lower than 100 is raised back to the sample floor.
INSERT INTO material_quota (
    id, tenant_id, company_id, material_id, quota_period,
    allocated_quota, consumed_quota, created_at, updated_at
)
SELECT
    md5('sikalongan:quota:' || m.model_code || ':' ||
        to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM'))::uuid,
    m.tenant_id, m.company_id,
    md5('sikalongan:material:' || m.model_code)::uuid,
    date_trunc('month', CURRENT_DATE)::date,
    100, 0, NOW(), NOW()
FROM model m
WHERE m.tenant_id=(SELECT id FROM tenant WHERE tenant_code='sikalongan.com')
  AND m.company_id=md5('sikalongan:company')::uuid
  AND m.model_code LIKE 'SIKALA-%'
ON CONFLICT (material_id, tenant_id, company_id, quota_period) DO UPDATE SET
    allocated_quota=GREATEST(material_quota.allocated_quota, EXCLUDED.allocated_quota),
    updated_at=NOW();

-- Stable public product catalog / ordering link.
INSERT INTO shop_access_token (
    id, token, tenant_id, company_id, table_id, token_type,
    description, access_count, created_at, expires_at, enabled
)
VALUES (
    md5('sikalongan:public-menu-token')::uuid,
    'sikalongan-menu-2026',
    (SELECT id FROM tenant WHERE tenant_code='sikalongan.com'),
    md5('sikalongan:company')::uuid,
    NULL, 'QUEUE_QR', 'Sika Long An public product catalog',
    0, NOW(), NULL, TRUE
)
ON CONFLICT (token) DO UPDATE SET
    tenant_id=EXCLUDED.tenant_id,
    company_id=EXCLUDED.company_id,
    table_id=NULL,
    token_type='QUEUE_QR',
    description=EXCLUDED.description,
    enabled=TRUE;

ALTER TABLE usertb
    ADD COLUMN IF NOT EXISTS lasttenantid varchar(36),
    ADD COLUMN IF NOT EXISTS lastcompanyid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedtenantid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedcompanyid varchar(36);

-- BCrypt $2b$, cost 13, plaintext password: sikalongan
INSERT INTO usertb (
    username, password, firstname, lastname, email,
    isaccountnonexpired, isaccountnonlocked, iscredentialsnonexpired,
    isallowmarketing, isenabled, createdtime, validationcode, leaderid,
    lasttenantid, lastcompanyid, assignedtenantid, assignedcompanyid
)
VALUES (
    'sikalongan',
    '$2b$13$YnCnjreulzoSPqmH/M2P7.IZZVE.b5UWc1IvUTlbY83jwD/dk8KBW',
    'Sika Long An', 'Huỳnh Toàn', 'admin@sikalongan.com',
    TRUE, TRUE, TRUE, FALSE, TRUE, NOW(), '', 0,
    (SELECT id::text FROM tenant WHERE tenant_code='sikalongan.com'),
    md5('sikalongan:company')::uuid::text,
    (SELECT id::text FROM tenant WHERE tenant_code='sikalongan.com'),
    md5('sikalongan:company')::uuid::text
)
ON CONFLICT (username) DO UPDATE SET
    password=EXCLUDED.password,
    firstname=EXCLUDED.firstname,
    lastname=EXCLUDED.lastname,
    email=EXCLUDED.email,
    isaccountnonexpired=TRUE,
    isaccountnonlocked=TRUE,
    iscredentialsnonexpired=TRUE,
    isenabled=TRUE,
    lasttenantid=EXCLUDED.lasttenantid,
    lastcompanyid=EXCLUDED.lastcompanyid,
    assignedtenantid=EXCLUDED.assignedtenantid,
    assignedcompanyid=EXCLUDED.assignedcompanyid;

INSERT INTO authorities (username, authority, description, visible)
SELECT 'sikalongan', 'ROLE_ADMIN', 'Sika Long An shop administrator', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM authorities
    WHERE username='sikalongan' AND authority='ROLE_ADMIN'
);

COMMIT;

-- Verification:
-- SELECT tenant_code, tenant_name FROM tenant WHERE tenant_code='sikalongan.com';
-- SELECT company_code, company_name, shop_name FROM company WHERE company_code='SIKALONGAN';
-- SELECT category, COUNT(*) FROM model WHERE model_code LIKE 'SIKALA-%' AND is_active GROUP BY category ORDER BY category;
-- SELECT model_code, model_name, selling_price, image_url FROM model WHERE model_code LIKE 'SIKALA-%' ORDER BY category, model_name;
-- SELECT m.model_code, mat.unit, mb.qty_per_unit, mb.warehouse_unit FROM model m JOIN model_bom mb ON mb.model_id=m.id JOIN material mat ON mat.id=mb.material_id WHERE m.model_code LIKE 'SIKALA-%';
-- SELECT COUNT(*) AS shop_bom_leaf_rows FROM bom_item bi JOIN bom b ON b.id=bi.bom_id JOIN model m ON m.id=b.model_id WHERE m.model_code LIKE 'SIKALA-%';
-- SELECT COUNT(*) AS sample_inventory_rows, SUM(quantity_on_hand) AS sample_quantity FROM inventory WHERE warehouse_id=md5('sikalongan:warehouse:main')::uuid;
-- SELECT day_of_week, start_time, end_time FROM shop_shift WHERE company_id=md5('sikalongan:company')::uuid ORDER BY day_of_week;
-- SELECT token, enabled FROM shop_access_token WHERE token='sikalongan-menu-2026';
-- SELECT username, isenabled, assignedtenantid, assignedcompanyid FROM usertb WHERE username='sikalongan';
