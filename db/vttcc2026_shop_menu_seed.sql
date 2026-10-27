-- Vietnamese VTTCC shop menu and warehouse-cost examples.
-- Run after the core schemas and the shop pricing migrations.
-- All menu selling prices are intentionally higher than their warehouse cost.
BEGIN;

INSERT INTO material (id,tenant_id,company_id,material_code,material_name,unit,material_type,price,is_active,created_at)
VALUES
('0198f600-0000-7000-9100-000000000001',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','CASE-VP','Thùng máy văn phòng','cái','LINH_KIEN',850000,TRUE,NOW()),
('0198f600-0000-7000-9100-000000000002',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','RAM-8G','RAM 8GB DDR4','thanh','LINH_KIEN',420000,TRUE,NOW()),
('0198f600-0000-7000-9100-000000000003',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','CPU-I5','Bộ xử lý Intel Core i5','bộ','LINH_KIEN',2850000,TRUE,NOW()),
('0198f600-0000-7000-9100-000000000004',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','VGA-4G','Card màn hình 4GB','cái','LINH_KIEN',2600000,TRUE,NOW()),
('0198f600-0000-7000-9100-000000000005',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MAIN-H610','Bo mạch chủ H610','cái','LINH_KIEN',1750000,TRUE,NOW()),
('0198f600-0000-7000-9100-000000000006',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','SSD-512','Ổ cứng SSD 512GB','cái','LINH_KIEN',950000,TRUE,NOW()),
('0198f600-0000-7000-9100-000000000007',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','HDD-1T','Ổ cứng HDD 1TB','cái','LINH_KIEN',1250000,TRUE,NOW()),
('0198f600-0000-7000-9100-000000000008',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','PSU-500','Nguồn máy tính 500W','cái','LINH_KIEN',650000,TRUE,NOW()),
('0198f600-0000-7000-9100-000000000009',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MON-24','Màn hình 24 inch','cái','THIET_BI',2150000,TRUE,NOW()),
('0198f600-0000-7000-9100-00000000000a',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','KB-MOUSE','Bộ bàn phím và chuột','bộ','THIET_BI',280000,TRUE,NOW()),
('0198f600-0000-7000-9100-00000000000b',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','LAN-CAT6','Dây mạng LAN CAT6','mét','VẬT_TƯ',8500,TRUE,NOW()),
('0198f600-0000-7000-9100-00000000000c',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','RJ45-100','Đầu mạng RJ45','cái','VẬT_TƯ',1800,TRUE,NOW()),
('0198f600-0000-7000-9100-00000000000d',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','SW-8P','Bộ chia mạng 8 cổng','cái','THIET_BI',520000,TRUE,NOW()),
('0198f600-0000-7000-9100-00000000000e',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','INK-BLACK','Mực in đen phổ thông','hộp','MỰC_IN',175000,TRUE,NOW()),
('0198f600-0000-7000-9100-00000000000f',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','INK-COLOR','Mực in màu phổ thông','hộp','MỰC_IN',245000,TRUE,NOW())
ON CONFLICT (id) DO UPDATE SET material_name=EXCLUDED.material_name,price=EXCLUDED.price,is_active=TRUE;

INSERT INTO inventory (id,material_id,warehouse_id,quantity_on_hand,quantity_locked,batch_no,tenant_id,company_id,material_code,material_name,warehouse_code,warehouse_name,quantity_reserved,created_at,updated_at)
SELECT ('0198f600-0000-7000-9200-'||RIGHT(m.id::text,12))::uuid,m.id,'0198f600-0000-7000-8100-000000000001',q.qty,0,'VTTCC-MENU-2026',t.id,c.id,m.material_code,m.material_name,'VTTCC-HCM','Kho VTTCC - Hồ Chí Minh',0,NOW(),NOW()
FROM material m CROSS JOIN tenant t CROSS JOIN company c
JOIN (VALUES ('CASE-VP',20::numeric),('RAM-8G',30::numeric),('CPU-I5',15::numeric),('VGA-4G',10::numeric),('MAIN-H610',12::numeric),('SSD-512',20::numeric),('HDD-1T',15::numeric),('PSU-500',20::numeric),('MON-24',12::numeric),('KB-MOUSE',25::numeric),('LAN-CAT6',1000::numeric),('RJ45-100',500::numeric),('SW-8P',15::numeric),('INK-BLACK',50::numeric),('INK-COLOR',35::numeric)) q(code,qty) ON q.code=m.material_code
WHERE t.tenant_code='vttcc2026' AND c.company_code='VTTCC'
ON CONFLICT (id) DO UPDATE SET quantity_on_hand=EXCLUDED.quantity_on_hand,updated_at=NOW();

INSERT INTO model (id,tenant_id,company_id,model_code,model_name,category,is_active,selling_price,created_at)
VALUES
('0198f600-0000-7000-9300-000000000001',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-CASE-VP','Thùng máy văn phòng','VĂN PHÒNG',TRUE,1250000,NOW()),
('0198f600-0000-7000-9300-000000000002',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-RAM-8G','RAM 8GB DDR4','LINH KIỆN',TRUE,650000,NOW()),
('0198f600-0000-7000-9300-000000000003',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-CPU-I5','Bộ xử lý Intel Core i5','LINH KIỆN',TRUE,3800000,NOW()),
('0198f600-0000-7000-9300-000000000004',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-VGA-4G','Card màn hình 4GB','LINH KIỆN',TRUE,3400000,NOW()),
('0198f600-0000-7000-9300-000000000005',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-MAIN-H610','Bo mạch chủ H610','LINH KIỆN',TRUE,2350000,NOW()),
('0198f600-0000-7000-9300-000000000006',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-SSD-512','Ổ cứng SSD 512GB','LINH KIỆN',TRUE,1350000,NOW()),
('0198f600-0000-7000-9300-000000000007',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-HDD-1T','Ổ cứng HDD 1TB','LINH KIỆN',TRUE,1700000,NOW()),
('0198f600-0000-7000-9300-000000000008',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-PSU-500','Nguồn máy tính 500W','LINH KIỆN',TRUE,900000,NOW()),
('0198f600-0000-7000-9300-000000000009',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-MON-24','Màn hình 24 inch','THIẾT BỊ',TRUE,2850000,NOW()),
('0198f600-0000-7000-9300-00000000000a',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-KB-MOUSE','Bộ bàn phím và chuột','THIẾT BỊ',TRUE,450000,NOW()),
('0198f600-0000-7000-9300-00000000000b',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-LAN-CAT6','Dây mạng LAN CAT6','VẬT TƯ MẠNG',TRUE,15000,NOW()),
('0198f600-0000-7000-9300-00000000000c',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-RJ45-100','Đầu mạng RJ45','VẬT TƯ MẠNG',TRUE,4000,NOW()),
('0198f600-0000-7000-9300-00000000000d',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-SW-8P','Bộ chia mạng 8 cổng','THIẾT BỊ MẠNG',TRUE,750000,NOW()),
('0198f600-0000-7000-9300-00000000000e',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-INK-BLACK','Mực in đen phổ thông','MỰC IN',TRUE,280000,NOW()),
('0198f600-0000-7000-9300-00000000000f',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-INK-COLOR','Mực in màu phổ thông','MỰC IN',TRUE,380000,NOW()),
('0198f600-0000-7000-9300-000000000010',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-LABOR-CHECK','Công kiểm tra và tư vấn kỹ thuật','DỊCH VỤ',TRUE,250000,NOW()),
('0198f600-0000-7000-9300-000000000011',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-LABOR-INSTALL','Công lắp đặt và cài đặt máy','DỊCH VỤ',TRUE,450000,NOW()),
('0198f600-0000-7000-9300-000000000012',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-LABOR-MAINT','Công sửa chữa và bảo trì','DỊCH VỤ',TRUE,350000,NOW()),
('0198f600-0000-7000-9300-000000000013',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-FOOD-TECH','Suất ăn kỹ thuật viên','ĂN UỐNG',TRUE,220000,NOW()),
('0198f600-0000-7000-9300-000000000014',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MENU-DRINK-TECH','Nước uống công trình','ĂN UỐNG',TRUE,35000,NOW())
ON CONFLICT (id) DO UPDATE SET model_name=EXCLUDED.model_name,category=EXCLUDED.category,selling_price=EXCLUDED.selling_price,is_active=TRUE;

INSERT INTO model_bom (id,model_id,material_id,qty_per_unit,tenant_id,company_id)
SELECT ('0198f600-0000-7000-9400-'||RIGHT(m.id::text,12))::uuid,mo.id,m.id,1,t.id,c.id
FROM material m JOIN model mo ON mo.model_code='MENU-'||m.material_code
CROSS JOIN tenant t CROSS JOIN company c
WHERE t.tenant_code='vttcc2026' AND c.company_code='VTTCC'
ON CONFLICT (id) DO UPDATE SET qty_per_unit=1;

COMMIT;
