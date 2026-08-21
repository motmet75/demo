-- SAN Coffee and Tea - Tên Lửa shop seed for the BOM application.
-- PostgreSQL UTF-8; rerunnable after the BOM/shop/auth migrations.
-- Source: shop-owner menu-board photo supplied 2026-08-21.
-- ShopeeFood URL supplied by owner was not machine-readable during preparation.
-- Login: sancoffee / san2026
-- Public ordering URL after deployment:
--   https://YOUR_HOST/bom-inventory/shop/menu?t=san-ten-lua-menu-2026
--
-- Board transcription note: the handwritten coffee prices appear to show
-- Cà phê muối and Cà phê đá at 20,000 (S) / 40,000 (L). Verify these two
-- size prices with the shop before production use.

BEGIN;

INSERT INTO tenant (id, created_at, tenant_code, tenant_name, tenant_type, is_active)
VALUES ('019b5a10-0000-7000-8000-000000000001', NOW(),
        'san-coffee-tea.anhmedia.vn', 'SAN Coffee and Tea', 'SHOP', TRUE)
ON CONFLICT (tenant_code) DO UPDATE SET
    tenant_name=EXCLUDED.tenant_name, tenant_type='SHOP', is_active=TRUE;

INSERT INTO company (
    id, company_code, company_name, created_at, tenant_id,
    bank_bin, bank_account_number, bank_account_name,
    last_order_number, prepaid_menu, realtime_inventory,
    shop_processing_inventory_recheck
)
VALUES (
    '019b5a10-0000-7000-8000-000000000002', 'SAN-TEN-LUA',
    'SAN Coffee and Tea - Tên Lửa', NOW(),
    '019b5a10-0000-7000-8000-000000000001',
    NULL, NULL, NULL, 0, FALSE, FALSE, TRUE
)
ON CONFLICT (id) DO UPDATE SET
    company_code=EXCLUDED.company_code,
    company_name=EXCLUDED.company_name,
    tenant_id=EXCLUDED.tenant_id;

-- Ten dine-in tables. Takeaway and delivery are fulfillment types and do not
-- need fake table records.
INSERT INTO shop_table (id, tenant_id, company_id, table_name, is_active, created_at)
SELECT md5('san-ten-lua:table:' || n::text)::uuid,
       '019b5a10-0000-7000-8000-000000000001',
       '019b5a10-0000-7000-8000-000000000002',
       'Bàn ' || LPAD(n::text, 2, '0'), TRUE, NOW()
FROM generate_series(1, 10) AS n
ON CONFLICT (id) DO UPDATE SET table_name=EXCLUDED.table_name, is_active=TRUE;

-- Disable older SAN catalog rows before reapplying this photographed menu.
UPDATE model SET is_active=FALSE
WHERE tenant_id='019b5a10-0000-7000-8000-000000000001'
  AND company_id='019b5a10-0000-7000-8000-000000000002'
  AND model_code LIKE 'SAN-%';

WITH menu(ordinal, model_name, selling_price, category, image_url) AS (
VALUES
    (1,  'Trà xoài chanh dây',       35000, 'TRÀ TRÁI CÂY', '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (2,  'Trà đào',                  30000, 'TRÀ TRÁI CÂY', '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (3,  'Trà mãng cầu',             30000, 'TRÀ TRÁI CÂY', '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (4,  'Trà ổi hồng',              30000, 'TRÀ TRÁI CÂY', '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (5,  'Trà dâu',                  30000, 'TRÀ TRÁI CÂY', '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (6,  'Trà chanh',                20000, 'TRÀ TRÁI CÂY', '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (7,  'Hồng trà tắc',             20000, 'TRÀ TRÁI CÂY', '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (8,  'Trà cam xí muội',          30000, 'TRÀ TRÁI CÂY', '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (9,  'Trà chanh vải xoài',       35000, 'TRÀ TRÁI CÂY', '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (10, 'Trà sữa ô long',           35000, 'TRÀ SỮA',      '/bom-inventory/san-coffee/images/milk-tea.webp'),
    (11, 'Trà sữa lài',              30000, 'TRÀ SỮA',      '/bom-inventory/san-coffee/images/milk-tea.webp'),
    (12, 'Trà sữa ô long lài',       35000, 'TRÀ SỮA',      '/bom-inventory/san-coffee/images/milk-tea.webp'),
    (13, 'Hồng trà sữa',             30000, 'TRÀ SỮA',      '/bom-inventory/san-coffee/images/milk-tea.webp'),
    (14, 'Soda dâu',                 20000, 'SODA',          '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (15, 'Soda kiwi',                20000, 'SODA',          '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (16, 'Soda việt quất',           20000, 'SODA',          '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (17, 'Soda xoài',                20000, 'SODA',          '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (18, 'Soda chanh dây',           20000, 'SODA',          '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (19, 'Cà phê muối',              20000, 'COFFEE',        '/bom-inventory/san-coffee/images/coffee.webp'),
    (20, 'Cà phê đá',                20000, 'COFFEE',        '/bom-inventory/san-coffee/images/coffee.webp'),
    (21, 'Cà phê sữa tươi',          35000, 'COFFEE',        '/bom-inventory/san-coffee/images/coffee.webp'),
    (22, 'Cà phê sữa',               20000, 'COFFEE',        '/bom-inventory/san-coffee/images/coffee.webp'),
    (23, 'Matcha Latte',             35000, 'MATCHA',        '/bom-inventory/san-coffee/images/matcha.webp'),
    (24, 'Coco Matcha',              35000, 'MATCHA',        '/bom-inventory/san-coffee/images/matcha.webp'),
    (25, 'Matcha Kem Cheese',        45000, 'MATCHA',        '/bom-inventory/san-coffee/images/matcha.webp'),
    (26, 'Trân châu đen',             5000, 'TOPPING',       '/bom-inventory/san-coffee/images/milk-tea.webp'),
    (27, 'Thạch dừa sợi',             5000, 'TOPPING',       '/bom-inventory/san-coffee/images/milk-tea.webp'),
    (28, 'Đào',                        7000, 'TOPPING',       '/bom-inventory/san-coffee/images/fruit-tea.webp'),
    (29, 'Kem Cheese',                10000, 'TOPPING',       '/bom-inventory/san-coffee/images/matcha.webp')
)
INSERT INTO model (
    id, model_code, model_name, is_active, created_at, tenant_id, company_id,
    selling_price, category, image_url
)
SELECT md5('san-ten-lua:model:' || ordinal::text)::uuid,
       'SAN-' || LPAD(ordinal::text, 3, '0'), model_name, TRUE, NOW(),
       '019b5a10-0000-7000-8000-000000000001',
       '019b5a10-0000-7000-8000-000000000002',
       selling_price, category, image_url
FROM menu
ON CONFLICT (id) DO UPDATE SET
    model_code=EXCLUDED.model_code, model_name=EXCLUDED.model_name,
    is_active=TRUE, tenant_id=EXCLUDED.tenant_id, company_id=EXCLUDED.company_id,
    selling_price=EXCLUDED.selling_price, category=EXCLUDED.category,
    image_url=EXCLUDED.image_url;

-- BOM headers allow costing/inventory recipes to be filled in later.
INSERT INTO bom (id, bom_name, version, status, created_at, tenant_id, model_id, company_id)
SELECT md5('san-ten-lua:bom:' || m.model_code)::uuid,
       m.model_name || ' BOM', 1, 'ACTIVE', NOW(), m.tenant_id, m.id, m.company_id
FROM model m
WHERE m.tenant_id='019b5a10-0000-7000-8000-000000000001'
  AND m.company_id='019b5a10-0000-7000-8000-000000000002'
  AND m.model_code LIKE 'SAN-%'
ON CONFLICT (tenant_id, model_id, version) DO UPDATE SET
    bom_name=EXCLUDED.bom_name, status='ACTIVE';

DELETE FROM model_menu_option
WHERE tenant_id='019b5a10-0000-7000-8000-000000000001'
  AND company_id='019b5a10-0000-7000-8000-000000000002';

-- The board explicitly shows S/L pricing for these two coffee items.
INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('san-ten-lua:option:size:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Kích cỡ',
       '[{"label":"Size S","price":0},{"label":"Size L","price":20000}]',
       TRUE, FALSE, 'Size S', 5, NOW(), FALSE
FROM model m
WHERE m.tenant_id='019b5a10-0000-7000-8000-000000000001'
  AND m.model_name IN ('Cà phê muối', 'Cà phê đá')
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, default_value='Size S', is_free=FALSE;

-- Free drink customization.
INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('san-ten-lua:option:sugar:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Mức đường',
       '["0%","30%","50%","70%","100%"]', FALSE, FALSE, '70%', 10, NOW(), TRUE
FROM model m
WHERE m.tenant_id='019b5a10-0000-7000-8000-000000000001' AND m.category <> 'TOPPING'
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, default_value='70%', is_free=TRUE;

INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('san-ten-lua:option:ice:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Mức đá',
       '["Không đá","Ít đá","Đá bình thường","Nhiều đá"]',
       FALSE, FALSE, 'Đá bình thường', 20, NOW(), TRUE
FROM model m
WHERE m.tenant_id='019b5a10-0000-7000-8000-000000000001' AND m.category <> 'TOPPING'
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, default_value='Đá bình thường', is_free=TRUE;

-- Paid toppings are selectable directly on every drink.
INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('san-ten-lua:option:topping:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Topping',
       '[{"label":"Trân châu đen","price":5000},{"label":"Thạch dừa sợi","price":5000},{"label":"Đào","price":7000},{"label":"Kem Cheese","price":10000}]',
       FALSE, TRUE, NULL, 30, NOW(), FALSE
FROM model m
WHERE m.tenant_id='019b5a10-0000-7000-8000-000000000001' AND m.category <> 'TOPPING'
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, is_free=FALSE;

-- Stable public menu/ordering link. Orders created with this token automatically
-- receive a shareable tracking session URL after checkout.
INSERT INTO shop_access_token (
    id, token, tenant_id, company_id, table_id, token_type,
    description, access_count, created_at, expires_at, enabled
)
VALUES (
    md5('san-ten-lua:public-menu-token')::uuid,
    'san-ten-lua-menu-2026',
    '019b5a10-0000-7000-8000-000000000001',
    '019b5a10-0000-7000-8000-000000000002',
    NULL, 'QUEUE_QR', 'SAN Tên Lửa public ordering menu', 0, NOW(), NULL, TRUE
)
ON CONFLICT (token) DO UPDATE SET
    tenant_id=EXCLUDED.tenant_id, company_id=EXCLUDED.company_id,
    table_id=NULL, token_type='QUEUE_QR', description=EXCLUDED.description, enabled=TRUE;

ALTER TABLE usertb
    ADD COLUMN IF NOT EXISTS lasttenantid varchar(36),
    ADD COLUMN IF NOT EXISTS lastcompanyid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedtenantid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedcompanyid varchar(36);

-- BCrypt cost 13; plaintext password: san2026
INSERT INTO usertb (
    username, password, firstname, lastname, email,
    isaccountnonexpired, isaccountnonlocked, iscredentialsnonexpired,
    isallowmarketing, isenabled, createdtime, validationcode, leaderid,
    lasttenantid, lastcompanyid, assignedtenantid, assignedcompanyid
)
VALUES (
    'sancoffee',
    '$2y$13$Jm9a/MVfPWxFjWcBkvHriuDPNz77IXKDc7aRDUwRBjIKCKtxtP3Wi',
    'SAN', 'Coffee and Tea', 'sancoffee@anhmedia.vn',
    TRUE, TRUE, TRUE, FALSE, TRUE, NOW(), '', 0,
    '019b5a10-0000-7000-8000-000000000001',
    '019b5a10-0000-7000-8000-000000000002',
    '019b5a10-0000-7000-8000-000000000001',
    '019b5a10-0000-7000-8000-000000000002'
)
ON CONFLICT (username) DO UPDATE SET
    password=EXCLUDED.password, firstname=EXCLUDED.firstname,
    lastname=EXCLUDED.lastname, email=EXCLUDED.email,
    isaccountnonexpired=TRUE, isaccountnonlocked=TRUE,
    iscredentialsnonexpired=TRUE, isenabled=TRUE,
    lasttenantid=EXCLUDED.lasttenantid, lastcompanyid=EXCLUDED.lastcompanyid,
    assignedtenantid=EXCLUDED.assignedtenantid, assignedcompanyid=EXCLUDED.assignedcompanyid;

INSERT INTO authorities (username, authority, description, visible)
SELECT 'sancoffee', 'ROLE_USER', 'SAN Coffee and Tea shop user', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM authorities WHERE username='sancoffee' AND authority='ROLE_USER'
);

COMMIT;

-- Verification:
-- SELECT tenant_code, tenant_name FROM tenant WHERE tenant_code='san-coffee-tea.anhmedia.vn';
-- SELECT category, COUNT(*) FROM model WHERE tenant_id='019b5a10-0000-7000-8000-000000000001' GROUP BY category ORDER BY category;
-- SELECT token, enabled FROM shop_access_token WHERE token='san-ten-lua-menu-2026';
-- SELECT username, isenabled, assignedtenantid, assignedcompanyid FROM usertb WHERE username='sancoffee';
