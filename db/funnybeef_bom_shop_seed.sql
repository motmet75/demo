-- Funny Beef - Spaghetti & Beefsteak sample shop for the BOM application in /opt/tuonghoa/demo.
-- Source: https://www.foody.vn/ho-chi-minh/a-hoai-my-y-sot-bo-my-nguyen-van-luong
-- NOTE: Foody does not publish a structured item-by-item menu with prices for this
-- restaurant -- only an overall price range (25.000đ - 95.000đ/người) and dish names
-- pulled from customer review photos (Mì Ý, Bò Bít Tết, Pizza, Salad, etc). The prices
-- below are reasonable estimates within that stated range, not scraped exact prices.
-- Menu names are bilingual: Vietnamese primary, Chinese (Mandarin) in parentheses.
-- PostgreSQL, UTF-8, rerunnable. Run after the BOM/shop/auth migrations.
-- Login: funnybeef / funnybeef123

BEGIN;

-- Stable IDs make the seed safe to rerun and easy to reference from integrations.
INSERT INTO tenant (id, created_at, tenant_code, tenant_name, tenant_type, is_active)
VALUES ('0198f200-0000-7000-8000-000000000001', NOW(),
        'funnybeef.anhmedia.vn', 'Funny Beef - Spaghetti & Beefsteak', 'SHOP', TRUE)
ON CONFLICT (tenant_code) DO UPDATE SET
    tenant_name = EXCLUDED.tenant_name,
    tenant_type = EXCLUDED.tenant_type,
    is_active = TRUE;

INSERT INTO company (
    id, company_code, company_name, created_at, tenant_id,
    bank_bin, bank_account_number, bank_account_name,
    last_order_number, prepaid_menu, realtime_inventory,
    shop_processing_inventory_recheck
)
VALUES (
    '0198f200-0000-7000-8000-000000000002', 'FUNNYBEEF',
    'Funny Beef - Nguyễn Văn Luông, Q6', NOW(),
    (SELECT id FROM tenant WHERE tenant_code = 'funnybeef.anhmedia.vn'),
    '970407', '9999999998', 'FUNNY BEEF SPAGHETTI BEEFSTEAK',
    0, FALSE, FALSE, TRUE
)
ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    tenant_id = EXCLUDED.tenant_id,
    bank_bin = '970407',
    bank_account_number = '9999999998',
    bank_account_name = 'FUNNY BEEF SPAGHETTI BEEFSTEAK';

-- POS tables.
INSERT INTO shop_table (id, tenant_id, company_id, table_name, is_active, created_at)
VALUES
('0198f200-0000-7000-8100-000000000001','0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002','Bàn 1',TRUE,NOW()),
('0198f200-0000-7000-8100-000000000002','0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002','Bàn 2',TRUE,NOW()),
('0198f200-0000-7000-8100-000000000003','0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002','Bàn 3',TRUE,NOW()),
('0198f200-0000-7000-8100-000000000004','0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002','Bàn 4',TRUE,NOW()),
('0198f200-0000-7000-8100-000000000005','0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002','Quầy',TRUE,NOW()),
('0198f200-0000-7000-8100-000000000006','0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002','Mang về',TRUE,NOW())
ON CONFLICT (id) DO UPDATE SET table_name=EXCLUDED.table_name, is_active=TRUE;

-- Shop menu (Vietnamese / Chinese bilingual names). Stable IDs provide the conflict
-- target because model_code is not guaranteed to have a unique constraint in every
-- deployed schema.
INSERT INTO model (
    id, model_code, model_name, is_active, created_at, tenant_id, company_id,
    selling_price, category, image_url
)
VALUES
('0198f200-0000-7000-8200-000000000001','FB-MI-Y-SOT-BO-BAM','Mì Ý Sốt Bò Bằm (肉酱意面)',TRUE,NOW(),'0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002',45000,'Mì Ý','/funnybeef/images/mi-y-sot-bo-bam.jpeg'),
('0198f200-0000-7000-8200-000000000002','FB-MI-Y-SOT-OLIVE','Mì Ý Sốt Olive (橄榄酱意面)',TRUE,NOW(),'0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002',40000,'Mì Ý','/funnybeef/images/mi-y-sot-olive.jpeg'),
('0198f200-0000-7000-8200-000000000003','FB-MI-Y-NHO','Mì Ý Phần Nhỏ (小份意面)',TRUE,NOW(),'0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002',30000,'Mì Ý','/funnybeef/images/mi-y-nho.jpeg'),
('0198f200-0000-7000-8200-000000000004','FB-NUI-Y-BO','Nui Ý Bò (牛肉通心粉)',TRUE,NOW(),'0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002',57000,'Nui Ý','/funnybeef/images/nui-y-bo.jpeg'),
('0198f200-0000-7000-8200-000000000005','FB-BO-BIT-TET','Bò Bít Tết (牛排)',TRUE,NOW(),'0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002',89000,'Beefsteak','/funnybeef/images/bo-bit-tet.jpeg'),
('0198f200-0000-7000-8200-000000000006','FB-VIEN-BO','Viên Bò (牛肉丸)',TRUE,NOW(),'0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002',15000,'Món thêm','/funnybeef/images/vien-bo.jpeg'),
('0198f200-0000-7000-8200-000000000007','FB-PIZZA-TRUYEN-THONG','Pizza Truyền Thống (传统披萨)',TRUE,NOW(),'0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002',95000,'Pizza','/funnybeef/images/pizza-truyen-thong.jpeg'),
('0198f200-0000-7000-8200-000000000008','FB-BANH-MI-BO-TOI','Bánh Mì Bơ Tỏi (蒜蓉黄油面包)',TRUE,NOW(),'0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002',25000,'Món thêm','/funnybeef/images/banh-mi-bo-toi.jpeg'),
('0198f200-0000-7000-8200-000000000009','FB-SALAD','Salad Trộn (沙拉)',TRUE,NOW(),'0198f200-0000-7000-8000-000000000001','0198f200-0000-7000-8000-000000000002',35000,'Salad','/funnybeef/images/salad.jpeg')
ON CONFLICT (id) DO UPDATE SET
    model_code=EXCLUDED.model_code, model_name=EXCLUDED.model_name, is_active=TRUE,
    tenant_id=EXCLUDED.tenant_id, company_id=EXCLUDED.company_id,
    selling_price=EXCLUDED.selling_price, category=EXCLUDED.category,
    image_url=EXCLUDED.image_url;

-- Active BOM headers let every menu model participate in BOM costing.
INSERT INTO bom (id, bom_name, version, status, created_at, tenant_id, model_id, company_id)
SELECT
    ('0198f200-0000-7000-8300-' || RIGHT(m.id::text, 12))::uuid,
    m.model_name || ' BOM', 1, 'ACTIVE', NOW(),
    m.tenant_id, m.id, m.company_id
FROM model m
WHERE m.model_code LIKE 'FB-%'
ON CONFLICT (tenant_id, model_id, version) DO UPDATE SET
    bom_name=EXCLUDED.bom_name, status='ACTIVE';

-- Common add-on choices used by the QR/POS menu (bilingual VN/CN labels).
INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT
    ('0198f200-0000-7000-8400-' || RIGHT(m.id::text, 12))::uuid,
    m.tenant_id, m.company_id, m.id, 'Thêm Bò (加牛肉)',
    '["Không thêm (不加)","+100g (加100克)","+200g (加200克)"]', FALSE, FALSE, 'Không thêm (不加)', 0, NOW(), FALSE
FROM model m WHERE m.model_code IN ('FB-MI-Y-SOT-BO-BAM','FB-MI-Y-SOT-OLIVE','FB-MI-Y-NHO','FB-NUI-Y-BO')
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, default_value='Không thêm (不加)', is_free=FALSE;

INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT
    ('0198f200-0000-7000-8500-' || RIGHT(m.id::text, 12))::uuid,
    m.tenant_id, m.company_id, m.id, 'Độ Chín (熟度)',
    '["Tái (三分熟)","Vừa (五分熟)","Chín kỹ (全熟)"]', TRUE, FALSE, 'Vừa (五分熟)', 1, NOW(), TRUE
FROM model m WHERE m.model_code = 'FB-BO-BIT-TET'
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, default_value='Vừa (五分熟)', is_free=TRUE;

-- Ensure current auth scoping columns exist (assignedCompanyId is used by the app).
ALTER TABLE usertb
    ADD COLUMN IF NOT EXISTS lasttenantid varchar(36),
    ADD COLUMN IF NOT EXISTS lastcompanyid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedtenantid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedcompanyid varchar(36);

-- BCrypt $2b$, cost 13, plaintext password: funnybeef123
INSERT INTO usertb (
    username, password, firstname, lastname, email,
    isaccountnonexpired, isaccountnonlocked, iscredentialsnonexpired,
    isallowmarketing, isenabled, createdtime, validationcode, leaderid,
    lasttenantid, lastcompanyid, assignedtenantid, assignedcompanyid
)
VALUES (
    'funnybeef',
    '$2b$13$sokyhdg1wVcKqwJUU1/pP.BcbQMkImhWMU4ON6tDgC667qHlABj4u',
    'Funny', 'Beef', 'funnybeef@anhmedia.vn',
    TRUE, TRUE, TRUE, FALSE, TRUE, NOW(), '', 0,
    '0198f200-0000-7000-8000-000000000001',
    '0198f200-0000-7000-8000-000000000002',
    '0198f200-0000-7000-8000-000000000001',
    '0198f200-0000-7000-8000-000000000002'
)
ON CONFLICT (username) DO UPDATE SET
    password=EXCLUDED.password, firstname=EXCLUDED.firstname,
    lastname=EXCLUDED.lastname, email=EXCLUDED.email,
    isaccountnonexpired=TRUE, isaccountnonlocked=TRUE,
    iscredentialsnonexpired=TRUE, isenabled=TRUE,
    lasttenantid=EXCLUDED.lasttenantid,
    lastcompanyid=EXCLUDED.lastcompanyid,
    assignedtenantid=EXCLUDED.assignedtenantid,
    assignedcompanyid=EXCLUDED.assignedcompanyid;

INSERT INTO authorities (username, authority, description, visible)
SELECT 'funnybeef', 'ROLE_USER', 'Funny Beef shop user', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM authorities WHERE username='funnybeef' AND authority='ROLE_USER'
);

COMMIT;

-- Verification:
-- SELECT tenant_code, tenant_name FROM tenant WHERE tenant_code='funnybeef.anhmedia.vn';
-- SELECT company_code, bank_bin, bank_account_number FROM company WHERE company_code='FUNNYBEEF';
-- SELECT model_code, model_name, selling_price FROM model WHERE model_code LIKE 'FB-%';
-- SELECT username, isenabled, assignedtenantid, assignedcompanyid FROM usertb WHERE username='funnybeef';
