-- Catalog examples transcribed from E:\Capture\gemini screenshots.
-- Warehouse price is the cost; model selling_price is the quick-sale price.
BEGIN;

INSERT INTO material (id, tenant_id, company_id, material_code, material_name, unit, material_type, price, is_active, created_at)
VALUES
 ('0198f600-0000-7000-9500-000000000001',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','SSD-KING-500NVME','Ổ cứng SSD Kingston NV2 500GB PCIe 4.0 NVMe','cái','LINH_KIEN',780000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-000000000002',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','RAM-COR-16GB3200','RAM Desktop Corsair Vengeance LPX 16GB DDR4 3200MHz','thanh','LINH_KIEN',720000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-000000000003',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MAIN-ASUS-B760M','Mainboard ASUS Prime B760M-A D4 (Socket 1700)','cái','LINH_KIEN',2450000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-000000000004',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','PSU-CM-650W','Nguồn máy tính Cooler Master MWE 650W 80 Plus Bronze','cái','LINH_KIEN',1050000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-000000000005',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','CAM-HIK-2MP-IP','Camera IP Dome Hikvision DS-2CD1123G2-LIU 2MP ColorVu','mắt','THIET_BI',680000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-000000000006',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','CAM-DAH-4MP-OUT','Camera IP Thân trụ Dahua 4MP chống ngược sáng WDR ngoài trời','mắt','THIET_BI',890000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-000000000007',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','NVR-HIK-8CH','Đầu ghi hình IP 8 Kênh Hikvision DS-7108NI-Q1/8P (tích hợp PoE)','đầu','THIET_BI',2150000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-000000000008',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','HDD-WD-PURPLE4TB','Ổ cứng chuyên dụng Camera WD Purple 4TB 24/7','ổ','THIET_BI',2150000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-000000000009',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','WIFI-UNIFI-U6PRO','Bộ phát WiFi 6 chuyên dụng UniFi U6-Pro','bộ','THIET_BI',3650000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-00000000000a',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','SW-TPLINK-8POE','Switch cấp nguồn PoE+ 8 Port Gigabit TP-Link TL-SG1008MP','cái','THIET_BI',1450000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-00000000000b',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','CAB-COMMSCOPE-CAT6','Cáp mạng CommScope Cat6 UTP chính hãng','mét','VAT_TU',6500,TRUE,NOW()),
 ('0198f600-0000-7000-9500-00000000000c',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','RJ45-AMP-CAT6','Hạt mạng RJ45 Cat6 bọc kim chống nhiễu (bịch 100 đầu)','bịch','VAT_TU',140000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-00000000000d',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','PRT-CANON-2900','Hộp mực in Laser Cartridge 12A dùng cho Canon 2900 / HP 1020','hộp','MUC_IN',165000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-00000000000e',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','DRUM-CANON-2900','Trống hình (Drum) + Gạt mực máy in Canon LBP 2900/3300','bộ','MUC_IN',65000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-00000000000f',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MCC-RONALD-RJ500','Máy chấm công vân tay và thẻ từ Ronald Jack X628-C','máy','THIET_BI',1950000,TRUE,NOW()),
 ('0198f600-0000-7000-9500-000000000010',(SELECT id FROM tenant WHERE tenant_code='vttcc2026'),'0198f600-0000-7000-8000-000000000002','MCC-ZKTECO-MB40','Máy chấm công nhận diện khuôn mặt và kiểm soát cửa ZKTeco MB40-VL','máy','THIET_BI',3200000,TRUE,NOW())
ON CONFLICT (id) DO UPDATE SET material_name=EXCLUDED.material_name, price=EXCLUDED.price, unit=EXCLUDED.unit, is_active=TRUE;

INSERT INTO inventory (id,material_id,warehouse_id,quantity_on_hand,quantity_locked,batch_no,tenant_id,company_id,material_code,material_name,warehouse_code,warehouse_name,quantity_reserved,created_at,updated_at)
SELECT ('0198f600-0000-7000-9800-'||RIGHT(m.id::text,12))::uuid,m.id,'0198f600-0000-7000-8100-000000000001',q.qty,0,'VTTCC-GEMINI-2026',t.id,c.id,m.material_code,m.material_name,'VTTCC-HCM','Kho VTTCC - Hồ Chí Minh',0,NOW(),NOW()
FROM material m CROSS JOIN tenant t CROSS JOIN company c
JOIN (VALUES ('SSD-KING-500NVME',18::numeric),('RAM-COR-16GB3200',14::numeric),('MAIN-ASUS-B760M',6::numeric),('PSU-CM-650W',8::numeric),('CAM-HIK-2MP-IP',32::numeric),('CAM-DAH-4MP-OUT',16::numeric),('NVR-HIK-8CH',5::numeric),('HDD-WD-PURPLE4TB',3::numeric),('WIFI-UNIFI-U6PRO',9::numeric),('SW-TPLINK-8POE',7::numeric),('CAB-COMMSCOPE-CAT6',180::numeric),('RJ45-AMP-CAT6',4::numeric),('PRT-CANON-2900',25::numeric),('DRUM-CANON-2900',3::numeric),('MCC-RONALD-RJ500',6::numeric),('MCC-ZKTECO-MB40',4::numeric)) q(code,qty) ON q.code=m.material_code
WHERE t.tenant_code='vttcc2026' AND c.company_code='VTTCC'
ON CONFLICT (id) DO UPDATE SET quantity_on_hand=EXCLUDED.quantity_on_hand,updated_at=NOW();

INSERT INTO model (id,tenant_id,company_id,model_code,model_name,category,is_active,selling_price,created_at)
SELECT ('0198f600-0000-7000-9600-'||RIGHT(m.id::text,12))::uuid,t.id,c.id,'GEMINI-'||m.material_code,m.material_name,'DANH MỤC GEMINI',TRUE,p.sell_price,NOW()
FROM material m CROSS JOIN tenant t CROSS JOIN company c
JOIN (VALUES ('SSD-KING-500NVME',1050000::numeric),('RAM-COR-16GB3200',980000::numeric),('MAIN-ASUS-B760M',2990000::numeric),('PSU-CM-650W',1390000::numeric),('CAM-HIK-2MP-IP',950000::numeric),('CAM-DAH-4MP-OUT',1250000::numeric),('NVR-HIK-8CH',2790000::numeric),('HDD-WD-PURPLE4TB',2650000::numeric),('WIFI-UNIFI-U6PRO',4350000::numeric),('SW-TPLINK-8POE',1850000::numeric),('CAB-COMMSCOPE-CAT6',10000::numeric),('RJ45-AMP-CAT6',250000::numeric),('PRT-CANON-2900',320000::numeric),('DRUM-CANON-2900',160000::numeric),('MCC-RONALD-RJ500',2650000::numeric),('MCC-ZKTECO-MB40',4290000::numeric)) p(code,sell_price) ON p.code=m.material_code
WHERE t.tenant_code='vttcc2026' AND c.company_code='VTTCC'
ON CONFLICT (id) DO UPDATE SET model_name=EXCLUDED.model_name,category=EXCLUDED.category,selling_price=EXCLUDED.selling_price,is_active=TRUE;

INSERT INTO model_bom (id,model_id,material_id,qty_per_unit,tenant_id,company_id)
SELECT ('0198f600-0000-7000-9700-'||RIGHT(m.id::text,12))::uuid,mo.id,m.id,1,t.id,c.id
FROM material m JOIN model mo ON mo.model_code='GEMINI-'||m.material_code
CROSS JOIN tenant t CROSS JOIN company c
WHERE t.tenant_code='vttcc2026' AND c.company_code='VTTCC'
ON CONFLICT (id) DO UPDATE SET qty_per_unit=1;

COMMIT;
