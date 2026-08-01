-- Đại Lộ Coffee sample shop for the BOM application in /opt/tuonghoa/demo.
-- PostgreSQL, UTF-8, rerunnable. Run after the BOM/shop/auth migrations.
-- Login: dailocoffee / dailocoffee

BEGIN;

-- Stable IDs make the seed safe to rerun and easy to reference from integrations.
INSERT INTO tenant (id, created_at, tenant_code, tenant_name, tenant_type, is_active)
VALUES ('0198f100-0000-7000-8000-000000000001', NOW(),
        'dailocoffee.anhmedia.vn', 'Đại Lộ Coffee', 'SHOP', TRUE)
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
    '0198f100-0000-7000-8000-000000000002', 'DAILOCOFFEE',
    'Đại Lộ Coffee - Bình Phú', NOW(),
    (SELECT id FROM tenant WHERE tenant_code = 'dailocoffee.anhmedia.vn'),
    '970407', '9999999999', 'DAI LO COFFEE',
    0, FALSE, FALSE, TRUE
)
ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    tenant_id = EXCLUDED.tenant_id,
    bank_bin = '970407',
    bank_account_number = '9999999999',
    bank_account_name = 'DAI LO COFFEE';

-- POS tables.
INSERT INTO shop_table (id, tenant_id, company_id, table_name, is_active, created_at)
VALUES
('0198f100-0000-7000-8100-000000000001','0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002','Bàn 1',TRUE,NOW()),
('0198f100-0000-7000-8100-000000000002','0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002','Bàn 2',TRUE,NOW()),
('0198f100-0000-7000-8100-000000000003','0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002','Bàn 3',TRUE,NOW()),
('0198f100-0000-7000-8100-000000000004','0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002','Bàn 4',TRUE,NOW()),
('0198f100-0000-7000-8100-000000000005','0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002','Quầy',TRUE,NOW()),
('0198f100-0000-7000-8100-000000000006','0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002','Mang về',TRUE,NOW())
ON CONFLICT (id) DO UPDATE SET table_name=EXCLUDED.table_name, is_active=TRUE;

-- Shop menu. Stable IDs provide the conflict target because model_code is not
-- guaranteed to have a unique constraint in every deployed schema.
INSERT INTO model (
    id, model_code, model_name, is_active, created_at, tenant_id, company_id,
    selling_price, category, image_url
)
VALUES
('0198f100-0000-7000-8200-000000000001','DAILO-CA-PHE-SUA-DA','Cà Phê Sữa Đá',TRUE,NOW(),'0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002',29000,'Cà phê','/dailocoffee/images/gallery_9.jpeg'),
('0198f100-0000-7000-8200-000000000002','DAILO-CA-PHE-DEN-DA','Cà Phê Đen Đá',TRUE,NOW(),'0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002',25000,'Cà phê','/dailocoffee/images/gallery_8.jpeg'),
('0198f100-0000-7000-8200-000000000003','DAILO-BAC-XIU','Bạc Xỉu',TRUE,NOW(),'0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002',32000,'Cà phê','/dailocoffee/images/gallery_7.jpeg'),
('0198f100-0000-7000-8200-000000000004','DAILO-TRA-DAO-CAM-SA','Trà Đào Cam Sả',TRUE,NOW(),'0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002',39000,'Trà trái cây','/dailocoffee/images/gallery_6.jpeg'),
('0198f100-0000-7000-8200-000000000005','DAILO-TRA-VAI','Trà Vải',TRUE,NOW(),'0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002',39000,'Trà trái cây','/dailocoffee/images/gallery_5.jpeg'),
('0198f100-0000-7000-8200-000000000006','DAILO-MATCHA-LATTE','Matcha Latte',TRUE,NOW(),'0198f100-0000-7000-8000-000000000001','0198f100-0000-7000-8000-000000000002',45000,'Latte','/dailocoffee/images/gallery_4.jpeg')
ON CONFLICT (id) DO UPDATE SET
    model_code=EXCLUDED.model_code, model_name=EXCLUDED.model_name, is_active=TRUE,
    tenant_id=EXCLUDED.tenant_id, company_id=EXCLUDED.company_id,
    selling_price=EXCLUDED.selling_price, category=EXCLUDED.category,
    image_url=EXCLUDED.image_url;

-- Active BOM headers let every menu model participate in BOM costing.
INSERT INTO bom (id, bom_name, version, status, created_at, tenant_id, model_id, company_id)
SELECT
    ('0198f100-0000-7000-8300-' || RIGHT(m.id::text, 12))::uuid,
    m.model_name || ' BOM', 1, 'ACTIVE', NOW(),
    m.tenant_id, m.id, m.company_id
FROM model m
WHERE m.model_code LIKE 'DAILO-%'
ON CONFLICT (tenant_id, model_id, version) DO UPDATE SET
    bom_name=EXCLUDED.bom_name, status='ACTIVE';

-- Common drink choices used by the QR/POS menu.
INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT
    ('0198f100-0000-7000-8400-' || RIGHT(m.id::text, 12))::uuid,
    m.tenant_id, m.company_id, m.id, 'Đường',
    '["30%","50%","70%","100%"]', FALSE, FALSE, '70%', 0, NOW(), TRUE
FROM model m WHERE m.model_code LIKE 'DAILO-%'
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, default_value='70%', is_free=TRUE;

INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT
    ('0198f100-0000-7000-8500-' || RIGHT(m.id::text, 12))::uuid,
    m.tenant_id, m.company_id, m.id, 'Đá',
    '["Không đá","Ít đá","Nhiều đá"]', FALSE, FALSE, 'Ít đá', 1, NOW(), TRUE
FROM model m WHERE m.model_code LIKE 'DAILO-%'
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, default_value='Ít đá', is_free=TRUE;

-- Ensure current auth scoping columns exist (assignedCompanyId is used by the app).
ALTER TABLE usertb
    ADD COLUMN IF NOT EXISTS lasttenantid varchar(36),
    ADD COLUMN IF NOT EXISTS lastcompanyid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedtenantid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedcompanyid varchar(36);

-- BCrypt $2b$, cost 13, plaintext password: dailocoffee
INSERT INTO usertb (
    username, password, firstname, lastname, email,
    isaccountnonexpired, isaccountnonlocked, iscredentialsnonexpired,
    isallowmarketing, isenabled, createdtime, validationcode, leaderid,
    lasttenantid, lastcompanyid, assignedtenantid, assignedcompanyid
)
VALUES (
    'dailocoffee',
    '$2b$13$63qpEVIEHvJJ9hDYeYsSMeSrV/bLHRvwDAjpEDiZeEj7xq.cfoz.W',
    'Đại Lộ', 'Coffee', 'dailocoffee@anhmedia.vn',
    TRUE, TRUE, TRUE, FALSE, TRUE, NOW(), '', 0,
    '0198f100-0000-7000-8000-000000000001',
    '0198f100-0000-7000-8000-000000000002',
    '0198f100-0000-7000-8000-000000000001',
    '0198f100-0000-7000-8000-000000000002'
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
SELECT 'dailocoffee', 'ROLE_USER', 'Đại Lộ Coffee shop user', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM authorities WHERE username='dailocoffee' AND authority='ROLE_USER'
);

COMMIT;

-- Verification:
-- SELECT tenant_code, tenant_name FROM tenant WHERE tenant_code='dailocoffee.anhmedia.vn';
-- SELECT company_code, bank_bin, bank_account_number FROM company WHERE company_code='DAILOCOFFEE';
-- SELECT model_code, model_name, selling_price FROM model WHERE model_code LIKE 'DAILO-%';
-- SELECT username, isenabled, assignedtenantid, assignedcompanyid FROM usertb WHERE username='dailocoffee';
