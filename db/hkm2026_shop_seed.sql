-- HKM 2026 shop seed, reconstructed from the public ordering catalog supplied
-- by the shop owner. PostgreSQL UTF-8; rerunnable after BOM/shop/auth migrations.
-- Login: hkm2026 / hkm2026
--
-- Scope: menu.jpg catalog only (printed products/prices; matching public image URLs where available).
-- No source-shop customer details, order history, reviews, or private data are copied.

BEGIN;

INSERT INTO tenant (id, created_at, tenant_code, tenant_name, tenant_type, is_active)
VALUES ('019a2026-0000-7000-8000-000000000001', NOW(),
        'hkm2026.anhmedia.vn', 'HKM 2026', 'SHOP', TRUE)
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
    '019a2026-0000-7000-8000-000000000002', 'HKM2026',
    'HKM 2026', NOW(), '019a2026-0000-7000-8000-000000000001',
    NULL, NULL, NULL, 0, FALSE, FALSE, TRUE
)
ON CONFLICT (id) DO UPDATE SET
    company_code = EXCLUDED.company_code,
    company_name = EXCLUDED.company_name,
    tenant_id = EXCLUDED.tenant_id;

-- Ordering destinations for counter, dine-in, takeaway, and delivery flows.
INSERT INTO shop_table (id, tenant_id, company_id, table_name, is_active, created_at)
VALUES
('019a2026-0000-7000-8100-000000000001','019a2026-0000-7000-8000-000000000001','019a2026-0000-7000-8000-000000000002','Bàn 1',TRUE,NOW()),
('019a2026-0000-7000-8100-000000000002','019a2026-0000-7000-8000-000000000001','019a2026-0000-7000-8000-000000000002','Bàn 2',TRUE,NOW()),
('019a2026-0000-7000-8100-000000000003','019a2026-0000-7000-8000-000000000001','019a2026-0000-7000-8000-000000000002','Bàn 3',TRUE,NOW()),
('019a2026-0000-7000-8100-000000000004','019a2026-0000-7000-8000-000000000001','019a2026-0000-7000-8000-000000000002','Bàn 4',TRUE,NOW()),
('019a2026-0000-7000-8100-000000000005','019a2026-0000-7000-8000-000000000001','019a2026-0000-7000-8000-000000000002','Quầy',TRUE,NOW()),
('019a2026-0000-7000-8100-000000000006','019a2026-0000-7000-8000-000000000001','019a2026-0000-7000-8000-000000000002','Mang về',TRUE,NOW()),
('019a2026-0000-7000-8100-000000000007','019a2026-0000-7000-8000-000000000001','019a2026-0000-7000-8000-000000000002','Giao hàng',TRUE,NOW())
ON CONFLICT (id) DO UPDATE SET
    table_name = EXCLUDED.table_name,
    is_active = TRUE;

-- Printed menu redesign from menu.jpg; prices normalized to VND (1 = 1,000 VND).
ALTER TABLE model ADD COLUMN IF NOT EXISTS ingredients TEXT;

-- Make this printed menu authoritative when rerunning an older web-catalog seed.
UPDATE model
SET is_active=FALSE
WHERE tenant_id='019a2026-0000-7000-8000-000000000001'
  AND company_id='019a2026-0000-7000-8000-000000000002'
  AND model_code LIKE 'HKM-%';

WITH menu(ordinal, model_name, selling_price, category, image_url) AS (
VALUES
    (1, 'Trộn muối mỡ hành', 22000, 'BÁNH TRÁNG CUỐN - TRỘN', 'https://static.findfine.com/uploads/files/20240715/20240715_6ffa9ace89f4fb0299651e37ed17fb88_s.jpg'),
    (2, 'Trộn sate muối', 22000, 'BÁNH TRÁNG CUỐN - TRỘN', 'https://static.findfine.com/uploads/files/20240715/20240715_0ea05960eb5f545cae700617c9fe8006_s.jpg'),
    (3, 'Trộn muối mỡ hành sate', 27000, 'BÁNH TRÁNG CUỐN - TRỘN', 'https://static.findfine.com/uploads/files/20240715/20240715_464f97cf759167edc035f0861e76114e_s.jpg'),
    (4, 'Trộn tóp mỡ', 42000, 'BÁNH TRÁNG CUỐN - TRỘN', 'https://static.findfine.com/uploads/files/20240715/20240715_5b8419086984fcab9318502eb2c68d27_s.jpg'),
    (5, 'Bánh tráng cuốn', 32000, 'BÁNH TRÁNG CUỐN - TRỘN', 'https://static.findfine.com/uploads/files/20240821/20240821_f0f845f0bf6abc670fa8026a7da47452_s.jpg'),
    (6, 'Bánh tráng cuốn trộn muối bò', 45000, 'BÁNH TRÁNG CUỐN - TRỘN', 'https://static.findfine.com/uploads/files/20241117/20241117_cc0a4d664755dbe0e01144608c10ce5c_s.jpg'),
    (7, 'Chấm sate mỡ hành', 25000, 'BÁNH TRÁNG CUỐN - TRỘN', NULL),
    (8, 'Tóp mỡ', 15000, 'TOPPING BÁNH TRÁNG', 'https://static.findfine.com/uploads/files/20240711/20240711_75c153ee4a822ac632ce4fb7239e501d.jfif'),
    (9, 'Trứng cút (5 trứng)', 7000, 'TOPPING BÁNH TRÁNG', NULL),
    (10, 'Khô bò', 10000, 'TOPPING BÁNH TRÁNG', 'https://static.findfine.com/uploads/files/20240711/20240711_71b311852685b560b875028b6c4a692d_s.webp'),
    (11, 'Muối mỡ hành sate', 10000, 'TOPPING BÁNH TRÁNG', NULL),
    (12, 'Bánh phồng', 5000, 'TOPPING BÁNH TRÁNG', NULL),
    (13, 'Trứng muối', 10000, 'TOPPING BÁNH TRÁNG', 'https://static.findfine.com/uploads/files/20240711/20240711_47cde0bceea3af64df8d114bdef782c8.jfif'),
    (14, 'Muối bò', 10000, 'TOPPING BÁNH TRÁNG', NULL),
    (15, 'Hành phi', 7000, 'TOPPING BÁNH TRÁNG', 'https://static.findfine.com/uploads/files/20240711/20240711_39e6ccc06646acba31d1eabebd96858b_s.jpg'),
    (16, 'Bơ thêm', 5000, 'TOPPING BÁNH TRÁNG', NULL),
    (17, 'Chân gà sốt Thái / bóp mỡ hành sate', 70000, 'CHÂN GÀ', NULL),
    (18, 'Chân gà chiên mắm tỏi / lắc muối', 85000, 'CHÂN GÀ', NULL),
    (19, 'Gà chiên đặc biệt', 225000, 'CHÂN GÀ', 'https://static.findfine.com/uploads/files/20260419/20260419_ccae8d0422b0deaf3f7896fa57b5df82_s.png'),
    (20, 'Trứng non sốt Thái / bóp mỡ hành sate / mắm tỏi / lắc muối', 65000, 'TRỨNG NON - GÂN BÒ - SỨA', NULL),
    (21, 'Gân bò sốt Thái / bóp mỡ hành sate / mắm tỏi / lắc muối', 75000, 'TRỨNG NON - GÂN BÒ - SỨA', NULL),
    (22, 'Sứa đạn / Sứa chân mèo', 55000, 'TRỨNG NON - GÂN BÒ - SỨA', NULL),
    (23, 'Trứng non thêm', 15000, 'MIX THÊM', 'https://static.findfine.com/uploads/files/20260209/20260209_55e386735d9a277d132d2089e040f5ba_s.jpg'),
    (24, 'Mix gân bò 50gr', 25000, 'MIX THÊM', NULL),
    (25, 'Mix sứa 60gr', 20000, 'MIX THÊM', NULL),
    (26, 'Zú heo mix 100gr', 65000, 'MIX THÊM', NULL),
    (27, 'Ba chỉ bò 100gr', 30000, 'MIX THÊM', NULL),
    (28, 'Mix mực tươi 80gr', 60000, 'MIX THÊM', NULL),
    (29, 'Mix tôm 3 con', 25000, 'MIX THÊM', NULL),
    (30, 'Trứng cút chiên 10 viên', 15000, 'MIX THÊM', NULL),
    (31, 'Cá viên chiên 8 viên', 20000, 'MIX THÊM', NULL),
    (32, 'Chả ớt xiêm 100gr', 30000, 'MIX THÊM', NULL),
    (33, 'Chả lụa 100gr', 30000, 'MIX THÊM', NULL),
    (34, 'Zú heo mắm tỏi 200gr', 120000, 'VÚ HEO - CÁ VIÊN - BẮP XÀO', NULL),
    (35, 'Cá viên chiên sốt Thái / bóp mỡ hành sate', 42000, 'VÚ HEO - CÁ VIÊN - BẮP XÀO', NULL),
    (36, 'Cá viên chiên mắm tỏi / lắc muối', 42000, 'VÚ HEO - CÁ VIÊN - BẮP XÀO', NULL),
    (37, 'Thập cẩm chiên chấm sốt Thái', 60000, 'VÚ HEO - CÁ VIÊN - BẮP XÀO', 'https://static.findfine.com/uploads/files/20251002/20251002_faff3ad064c0f597fe7f805af4b6be65_s.jpg'),
    (38, 'Bắp xào', 25000, 'VÚ HEO - CÁ VIÊN - BẮP XÀO', NULL),
    (39, 'Bắp xào trứng muối', 55000, 'VÚ HEO - CÁ VIÊN - BẮP XÀO', NULL),
    (40, 'Trứng cút chiên sốt Thái', 28000, 'VÚ HEO - CÁ VIÊN - BẮP XÀO', NULL),
    (41, 'Mì trộn mỡ hành sate', 65000, 'BÚN THÁI - MÌ TRỘN', 'https://static.findfine.com/uploads/files/20250513/20250513_94b53f96491b699aba4a535720281266_s.jpg'),
    (42, 'Mì xào sụn gà trứng ốp la', 90000, 'BÚN THÁI - MÌ TRỘN', NULL),
    (43, 'Bún / mì Thái hải sản', 75000, 'BÚN THÁI - MÌ TRỘN', NULL),
    (44, 'Bún / mì Thái viên', 65000, 'BÚN THÁI - MÌ TRỘN', NULL),
    (45, 'Tré trộn không chả', 50000, 'BÚN THÁI - MÌ TRỘN', 'https://static.findfine.com/uploads/files/20241024/20241024_3fc6cabe0a67de3f096a02ee36dcb6ca_s.jpg'),
    (46, 'Tré trộn / tré trộn sốt Thái', 85000, 'BÚN THÁI - MÌ TRỘN', NULL),
    (47, 'Full topping sốt Thái', 215000, 'COMBO', 'https://static.findfine.com/uploads/files/20250618/20250618_baad8c913204365b8e25fc0842658512_s.jpg'),
    (48, 'Combo sứa cutie', 185000, 'COMBO', NULL),
    (49, 'Set Baby Love', 130000, 'COMBO', NULL),
    (50, 'Box đồ ăn Hảo Tỷ Muội kèm 2 nước', 379000, 'COMBO', NULL),
    (51, 'Combo Tiểu Thanh Tiểu My', 379000, 'COMBO', NULL),
    (52, 'Tút bút ki sốt', 40000, 'TÚT BÚT KI', NULL),
    (53, 'Tút bút ki sốt phô mai', 55000, 'TÚT BÚT KI', NULL),
    (54, 'Tút bút ki chiên sốt cay', 30000, 'TÚT BÚT KI', NULL),
    (55, 'Tút bút ki chiên lắc phô mai', 30000, 'TÚT BÚT KI', NULL),
    (56, 'Gà mix tút bút ki sốt phô mai', 85000, 'TÚT BÚT KI', NULL),
    (57, 'Gà mix tút bút ki chiên sốt', 85000, 'TÚT BÚT KI', NULL),
    (58, 'Mì gà mix tút bút ki sốt phô mai', 85000, 'TÚT BÚT KI', NULL),
    (59, 'Gà viên sốt cay', 60000, 'GÀ CHIÊN', 'https://static.findfine.com/uploads/files/20260730/20260730_fb026e05d94d0605c2411201d1341645_s.png'),
    (60, 'Gà viên lắc phô mai', 60000, 'GÀ CHIÊN', 'https://static.findfine.com/uploads/files/20260730/20260730_ff965a7d23b994ffe732791834dd5e04_s.png'),
    (61, 'Gà viên mắm tỏi', 60000, 'GÀ CHIÊN', NULL),
    (62, 'Gà viên sốt cay Hàn Quốc', 60000, 'GÀ CHIÊN', NULL),
    (63, 'Gà viên 3 loại sốt', 60000, 'GÀ CHIÊN', 'https://static.findfine.com/uploads/files/20260730/20260730_9917e16522687e134a4881e75fdcfc10_s.png'),
    (64, 'Cánh / đùi gà chiên', 39000, 'GÀ CHIÊN', NULL),
    (65, 'Sụn gà mắm tỏi / lắc phô mai', 65000, 'GÀ CHIÊN', NULL),
    (66, 'Mì Samsung ốp la', 45000, 'MÌ TRỘN SAMSUNG - KÈM SÚP', NULL),
    (67, 'Mì Samsung cá viên', 65000, 'MÌ TRỘN SAMSUNG - KÈM SÚP', NULL),
    (68, 'Mì Samsung tôm tươi', 80000, 'MÌ TRỘN SAMSUNG - KÈM SÚP', NULL),
    (69, 'Mì Samsung hải sản', 110000, 'MÌ TRỘN SAMSUNG - KÈM SÚP', 'https://static.findfine.com/uploads/files/20260730/20260730_980a1699a370a9bc9f25bed15c611b73_s.jpg'),
    (70, 'Mì Samsung full topping', 85000, 'MÌ TRỘN SAMSUNG - KÈM SÚP', NULL),
    (71, 'Mì Samsung bò xào', 85000, 'MÌ TRỘN SAMSUNG - KÈM SÚP', 'https://static.findfine.com/uploads/files/20260811/20260811_83fc5c61cda11bd032b894ffad6e13e9_s.png'),
    (72, 'Trân châu đen', 5000, 'TOPPING THÊM', 'https://static.findfine.com/uploads/files/20240711/20240711_004c8b9889d4693118af6492169b35c6_s.jpg'),
    (73, 'Trân châu trắng giòn', 7000, 'TOPPING THÊM', 'https://static.findfine.com/uploads/files/20240711/20240711_2bb045d476893aced6d27904613f5bc2.jfif'),
    (74, 'Sương sáo', 5000, 'TOPPING THÊM', NULL),
    (75, 'Củ năng', 7000, 'TOPPING THÊM', 'https://static.findfine.com/uploads/files/20240716/20240716_fa7175a613ecd39415de8115a04bc3cc_s.jpg'),
    (76, 'Trân châu dừa', 7000, 'TOPPING THÊM', 'https://static.findfine.com/uploads/files/20240802/20240802_bfc994d118ee41e744b2852464710373_s.jpg'),
    (77, 'Trà sữa Hongkong', 25000, 'TRÀ SỮA', 'https://static.findfine.com/uploads/files/20240715/20240715_a3615b99a5374d4fab0d00dba24bf14a_s.jpg'),
    (78, 'Trà sữa Matcha', 28000, 'TRÀ SỮA', 'https://static.findfine.com/uploads/files/20240715/20240715_13bd074d4b987e387f4cafec2e3d34fa_s.jpg'),
    (79, 'Trà sữa Olong', 25000, 'TRÀ SỮA', 'https://static.findfine.com/uploads/files/20240715/20240715_aabe5f768874389e5524e497efb6e209_s.jpg'),
    (80, 'Trà sữa Socola', 28000, 'TRÀ SỮA', 'https://static.findfine.com/uploads/files/20240715/20240715_5ca00d5e6e99fb1db450e8daa9130022_s.jpg'),
    (81, 'Trà sữa Lài', 25000, 'TRÀ SỮA', NULL),
    (82, 'Trà tắc', 22000, 'TRÀ TRÁI CÂY', 'https://static.findfine.com/uploads/files/20240715/20240715_430c808c957236416e49b24d78ac72ef_s.jpg'),
    (83, 'Hồng trà (không chua)', 22000, 'TRÀ TRÁI CÂY', NULL),
    (84, 'Trà dâu ly khổng lồ', 40000, 'TRÀ TRÁI CÂY', 'https://static.findfine.com/uploads/files/20250409/20250409_a9cab8b085b6507df9cb46372618d096_s.jpg'),
    (85, 'Trà vải khổng lồ', 40000, 'TRÀ TRÁI CÂY', NULL),
    (86, 'Trà nhãn lài ly khổng lồ', 40000, 'TRÀ TRÁI CÂY', NULL),
    (87, 'Trà xoài chanh dây khổng lồ', 40000, 'TRÀ TRÁI CÂY', 'https://static.findfine.com/uploads/files/20250506/20250506_834c35d463ff8699816289f70861b5b6_s.jpg'),
    (88, 'Quýt ép ly khổng lồ', 40000, 'TRÀ TRÁI CÂY', NULL),
    (89, 'Trà bí đao hạt chia', 40000, 'TRÀ TRÁI CÂY', 'https://static.findfine.com/uploads/files/20250506/20250506_0e94857cbec166741ee6dc9400615282_s.jpg'),
    (90, 'Matcha Latte', 35000, 'LATTE / SỮA TƯƠI', 'https://static.findfine.com/uploads/files/20241026/20241026_b826fe79c6e44acdb6e58f687f5453e9_s.jpg'),
    (91, 'Matcha Latte sữa dừa ly khổng lồ', 40000, 'LATTE / SỮA TƯƠI', NULL),
    (92, 'Sữa tươi cafe ly khổng lồ', 45000, 'LATTE / SỮA TƯƠI', 'https://static.findfine.com/uploads/files/20250530/20250530_fe42af70cd4ca57f2838859bb724b74a_s.jpg'),
    (93, 'Sữa dừa cafe ly khổng lồ', 45000, 'LATTE / SỮA TƯƠI', 'https://static.findfine.com/uploads/files/20250530/20250530_02ff3456692e84a79286e57e29c48c3b_s.jpg'),
    (94, 'Sữa tươi trân châu đường đen', 35000, 'LATTE / SỮA TƯƠI', 'https://static.findfine.com/uploads/files/20250515/20250515_a4a154aedc770aff15cbb039b2448a87_s.jpg')
)
INSERT INTO model (
    id, model_code, model_name, is_active, created_at, tenant_id, company_id,
    selling_price, category, image_url
)
SELECT
    md5('hkm2026:model:' || ordinal::text)::uuid,
    'HKM-' || LPAD(ordinal::text, 3, '0'),
    model_name, TRUE, NOW(),
    '019a2026-0000-7000-8000-000000000001',
    '019a2026-0000-7000-8000-000000000002',
    selling_price, category, image_url
FROM menu
ON CONFLICT (id) DO UPDATE SET
    model_code = EXCLUDED.model_code,
    model_name = EXCLUDED.model_name,
    is_active = TRUE,
    tenant_id = EXCLUDED.tenant_id,
    company_id = EXCLUDED.company_id,
    selling_price = EXCLUDED.selling_price,
    category = EXCLUDED.category,
    image_url = EXCLUDED.image_url;

-- Customer-facing cuisine composition transcribed from menu.jpg. This is
-- descriptive menu text, separate from BOM quantities used by inventory.
WITH ingredient_text(model_name, ingredients) AS (
VALUES
('Trộn muối mỡ hành','Mỡ hành, muối, 4 trứng cút, rau răm'),
('Trộn sate muối','Sate, 4 trứng cút, muối, rau răm'),
('Trộn muối mỡ hành sate','Mỡ hành, sate, muối, 4 trứng cút, rau răm, hành phi'),
('Trộn tóp mỡ','Mỡ hành, sate, muối, 4 trứng cút, rau răm, tóp mỡ'),
('Bánh tráng cuốn','Mỡ hành, hành phi, muối, 4 trứng cút, rau răm'),
('Bánh tráng cuốn trộn muối bò','Mỡ hành, hành phi, muối, 4 trứng cút, rau răm, trộn cùng muối bò'),
('Chấm sate mỡ hành','Mỡ hành, sate, muối, 4 trứng cút, rau răm, hành phi'),
('Chân gà sốt Thái / bóp mỡ hành sate','Chân gà, xoài, cóc, rau răm, sả'),
('Chân gà chiên mắm tỏi / lắc muối','Chân gà, rau răm, mỡ hành, sate'),
('Gà chiên đặc biệt','Chân gà, vú heo, trứng non, gân bò'),
('Trứng non sốt Thái / bóp mỡ hành sate / mắm tỏi / lắc muối','Trứng non, rau răm, xoài, cóc, sả'),
('Gân bò sốt Thái / bóp mỡ hành sate / mắm tỏi / lắc muối','Gân bò, rau răm, xoài, cóc'),
('Zú heo mắm tỏi 200gr','200gr zú heo, rau răm, hành phi'),
('Cá viên chiên sốt Thái / bóp mỡ hành sate','Cá viên, dưa leo, sốt chấm'),
('Cá viên chiên mắm tỏi / lắc muối','Cá viên, dưa leo, sốt chấm'),
('Thập cẩm chiên chấm sốt Thái','Cá viên, đậu hũ phô mai, bánh bao trứng cá, thanh cua, chả cá cốm, hải sản mayo, chả cá trứng cút, trứng cút chiên'),
('Bắp xào','Bắp, con ruốc, bơ, hành lá'),
('Bắp xào trứng muối','Bắp, 3 trứng muối, con ruốc, bơ, hành lá'),
('Trứng cút chiên sốt Thái','Trứng cút chiên, dưa leo, sốt chấm'),
('Mì trộn mỡ hành sate','Cá viên, đậu hũ phô mai, bánh trứng cá; dùng kèm nước lẩu Thái và ba chỉ bò'),
('Bún / mì Thái hải sản','Bò, mực, tôm, đậu hũ phô mai, cá viên, bánh bao trứng cá, rau muống, nấm kim châm'),
('Bún / mì Thái viên','Đậu hũ phô mai, cá viên, bánh bao trứng cá, sandwich, thanh cua, sò điệp, rau muống, nấm kim châm'),
('Tré trộn không chả','Tré tai heo, xoài, cóc, tỏi, rau răm'),
('Tré trộn / tré trộn sốt Thái','Tré tai heo, xoài, cóc, tỏi, rau răm, chả lụa, chả ớt xiêm xanh, nem'),
('Full topping sốt Thái','Gà, trứng non, mề, sứa, tôm, mực, gân bò, cá viên, xoài, cóc, rau răm'),
('Combo sứa cutie','Sứa đạn, sứa chân mèo, sứa thân chân'),
('Set Baby Love','Gà mắm hoặc muối, gà Thái, gà bóp'),
('Box đồ ăn Hảo Tỷ Muội kèm 2 nước','Sứa, gà, trứng non, mì trộn cá viên, gà chiên, gân, bánh tráng'),
('Combo Tiểu Thanh Tiểu My','Full mini sốt Thái, full mini gà chiên đặc biệt'),
('Gà viên 3 loại sốt','Cheese, kem phô mai, bơ tỏi'),
('Mì Samsung cá viên','Mì trộn Samsung kèm súp và cá viên'),
('Mì Samsung tôm tươi','Mì trộn Samsung kèm súp và tôm tươi'),
('Mì Samsung hải sản','Mì trộn Samsung kèm súp và hải sản'),
('Trà sữa Hongkong','Vị trà đậm, dành cho khách có gu trà đậm; đã gồm trân châu đen'),
('Trà sữa Matcha','Vị trà nhẹ, thơm matcha; đã gồm trân châu đen'),
('Trà sữa Olong','Vị trà olong nướng thơm nhẹ; đã gồm trân châu đen'),
('Trà sữa Socola','Vị socola hậu đắng nhẹ; đã gồm trân châu đen'),
('Trà sữa Lài','Thơm lài, hậu nhãn nhẹ; đã gồm trân châu đen'),
('Trà tắc','Chua ngọt đậm trà; đã gồm trân châu đen'),
('Hồng trà (không chua)','Ngọt nhẹ, không chua; đã gồm trân châu đen'),
('Trà dâu ly khổng lồ','Vị dâu tươi chua ngọt; đã gồm trân châu đen'),
('Trà vải khổng lồ','Chua chua ngọt ngọt, vị thanh mát; đã gồm trân châu đen'),
('Trà nhãn lài ly khổng lồ','Chua chua ngọt ngọt, vị thanh mát; đã gồm trân châu đen'),
('Trà xoài chanh dây khổng lồ','Chua ngọt thơm nhẹ vị lài; đã gồm trân châu đen'),
('Quýt ép ly khổng lồ','Chua dịu nhẹ xen vị thanh mát; đã gồm trân châu đen'),
('Trà bí đao hạt chia','Thơm ngọt bí đao, có củ năng và trân châu dừa; đã gồm trân châu đen'),
('Matcha Latte','Matcha kết hợp sữa Meiji; đã gồm trân châu đen'),
('Matcha Latte sữa dừa ly khổng lồ','Matcha kết hợp sữa dừa; đã gồm trân châu đen'),
('Sữa tươi cafe ly khổng lồ','Cafe kết hợp sữa tươi; đã gồm trân châu đen'),
('Sữa dừa cafe ly khổng lồ','Cafe kết hợp sữa tươi và nước cốt dừa; đã gồm trân châu đen'),
('Sữa tươi trân châu đường đen','Sữa tươi vị ngọt thanh kết hợp đường đen; đã gồm trân châu đen')
)
UPDATE model m
SET ingredients = ingredient_text.ingredients
FROM ingredient_text
WHERE m.tenant_id='019a2026-0000-7000-8000-000000000001'
  AND m.company_id='019a2026-0000-7000-8000-000000000002'
  AND m.model_name=ingredient_text.model_name;

-- Active BOM headers allow every sellable item to enter costing/inventory later.
INSERT INTO bom (id, bom_name, version, status, created_at, tenant_id, model_id, company_id)
SELECT
    md5('hkm2026:bom:' || m.model_code)::uuid,
    m.model_name || ' BOM', 1, 'ACTIVE', NOW(),
    m.tenant_id, m.id, m.company_id
FROM model m
WHERE m.tenant_id = '019a2026-0000-7000-8000-000000000001'
  AND m.company_id = '019a2026-0000-7000-8000-000000000002'
  AND m.model_code LIKE 'HKM-%'
ON CONFLICT (tenant_id, model_id, version) DO UPDATE SET
    bom_name = EXCLUDED.bom_name,
    status = 'ACTIVE';

-- Size pricing from menu.jpg. Each row is one product; larger sizes are
-- priced choices so customers do not see duplicate S/M/L/XL products.
DELETE FROM model_menu_option
WHERE tenant_id='019a2026-0000-7000-8000-000000000001'
  AND company_id='019a2026-0000-7000-8000-000000000002'
  AND model_id IN (
    SELECT id FROM model
    WHERE tenant_id='019a2026-0000-7000-8000-000000000001'
      AND company_id='019a2026-0000-7000-8000-000000000002'
      AND model_code LIKE 'HKM-%'
  );

INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('hkm2026:option:size:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Kích cỡ',
       CASE m.model_name
         WHEN 'Chân gà sốt Thái / bóp mỡ hành sate'
           THEN '[{"label":"S (7-9 chân)","price":0},{"label":"M (14-17 chân)","price":55000},{"label":"L (22-24 chân)","price":165000},{"label":"XL (36-40 chân)","price":270000}]'
         WHEN 'Chân gà chiên mắm tỏi / lắc muối'
           THEN '[{"label":"S (10 chân)","price":0},{"label":"M (15 chân)","price":40000},{"label":"L (34 chân)","price":160000},{"label":"XL (60 chân)","price":320000}]'
         WHEN 'Gà chiên đặc biệt'
           THEN '[{"label":"Size S","price":0},{"label":"Size L","price":165000}]'
         WHEN 'Trứng non sốt Thái / bóp mỡ hành sate / mắm tỏi / lắc muối'
           THEN '[{"label":"Size S","price":0},{"label":"Size M","price":40000},{"label":"Size L","price":90000}]'
         WHEN 'Gân bò sốt Thái / bóp mỡ hành sate / mắm tỏi / lắc muối'
           THEN '[{"label":"Size S","price":0},{"label":"Size M","price":40000},{"label":"Size L","price":100000}]'
         WHEN 'Sứa đạn / Sứa chân mèo'
           THEN '[{"label":"1 con","price":0},{"label":"3 con","price":110000}]'
         WHEN 'Combo sứa cutie'
           THEN '[{"label":"Size S","price":0},{"label":"Size L","price":185000}]'
       END,
       TRUE, FALSE,
       CASE
         WHEN m.model_name='Sứa đạn / Sứa chân mèo' THEN '1 con'
         WHEN m.model_name='Chân gà sốt Thái / bóp mỡ hành sate' THEN 'S (7-9 chân)'
         WHEN m.model_name='Chân gà chiên mắm tỏi / lắc muối' THEN 'S (10 chân)'
         ELSE 'Size S'
       END,
       5, NOW(), FALSE
FROM model m
WHERE m.tenant_id='019a2026-0000-7000-8000-000000000001'
  AND m.model_name IN (
    'Chân gà sốt Thái / bóp mỡ hành sate',
    'Chân gà chiên mắm tỏi / lắc muối',
    'Gà chiên đặc biệt',
    'Trứng non sốt Thái / bóp mỡ hành sate / mắm tỏi / lắc muối',
    'Gân bò sốt Thái / bóp mỡ hành sate / mắm tỏi / lắc muối',
    'Sứa đạn / Sứa chân mèo',
    'Combo sứa cutie'
  )
ON CONFLICT (id) DO UPDATE SET
    choices=EXCLUDED.choices,
    required=EXCLUDED.required,
    multi_select=EXCLUDED.multi_select,
    default_value=EXCLUDED.default_value,
    is_free=FALSE;

-- All drink sections support the printed 1-litre upgrade (+10,000₫).
INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('hkm2026:option:drink-size:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Kích cỡ',
       '[{"label":"Tiêu chuẩn","price":0},{"label":"Size 1 lít","price":10000}]',
       TRUE, FALSE, 'Tiêu chuẩn', 5, NOW(), FALSE
FROM model m
WHERE m.tenant_id='019a2026-0000-7000-8000-000000000001'
  AND m.category IN ('TRÀ SỮA','TRÀ TRÁI CÂY','LATTE / SỮA TƯƠI')
ON CONFLICT (id) DO UPDATE SET
    choices=EXCLUDED.choices,
    required=TRUE,
    multi_select=FALSE,
    default_value='Tiêu chuẩn',
    is_free=FALSE;

-- Drink ordering experience: sugar and ice are free single-choice groups.
INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('hkm2026:option:sugar:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Mức đường',
       '["0%","30%","50%","70%","100%"]', FALSE, FALSE, '70%', 10, NOW(), TRUE
FROM model m
WHERE m.tenant_id='019a2026-0000-7000-8000-000000000001'
  AND m.category IN ('TRÀ SỮA','TRÀ TRÁI CÂY','LATTE / SỮA TƯƠI')
ON CONFLICT (id) DO UPDATE SET
    choices=EXCLUDED.choices, default_value=EXCLUDED.default_value, is_free=TRUE;

INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('hkm2026:option:ice:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Mức đá',
       '["Không đá","Ít đá","Đá bình thường","Nhiều đá"]',
       FALSE, FALSE, 'Đá bình thường', 20, NOW(), TRUE
FROM model m
WHERE m.tenant_id='019a2026-0000-7000-8000-000000000001'
  AND m.category IN ('TRÀ SỮA','TRÀ TRÁI CÂY','LATTE / SỮA TƯƠI')
ON CONFLICT (id) DO UPDATE SET
    choices=EXCLUDED.choices, default_value=EXCLUDED.default_value, is_free=TRUE;

-- Paid drink toppings from the printed TOPPING THÊM section.
INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('hkm2026:option:drink-topping:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Topping thêm',
       '[{"label":"Trân châu đen","price":5000},{"label":"Trân châu trắng giòn","price":7000},{"label":"Sương sáo","price":5000},{"label":"Củ năng","price":7000},{"label":"Trân châu dừa","price":7000}]',
       FALSE, TRUE, NULL, 30, NOW(), FALSE
FROM model m
WHERE m.tenant_id='019a2026-0000-7000-8000-000000000001'
  AND m.category IN ('TRÀ SỮA','TRÀ TRÁI CÂY','LATTE / SỮA TƯƠI')
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, is_free=FALSE;

-- Optional +5,000₫ sauce choice from the printed GÀ CHIÊN section.
INSERT INTO model_menu_option (
    id, tenant_id, company_id, model_id, group_name, choices,
    required, multi_select, default_value, display_order, created_at, is_free
)
SELECT md5('hkm2026:option:sauce:' || m.id::text)::uuid,
       m.tenant_id, m.company_id, m.id, 'Thêm sốt',
       '[{"label":"Cheese","price":5000},{"label":"Kem phô mai","price":5000},{"label":"Mắm tỏi","price":5000},{"label":"Sốt cay Hàn","price":5000}]',
       FALSE, TRUE, NULL, 40, NOW(), FALSE
FROM model m
WHERE m.tenant_id='019a2026-0000-7000-8000-000000000001'
  AND m.category='GÀ CHIÊN'
ON CONFLICT (id) DO UPDATE SET choices=EXCLUDED.choices, is_free=FALSE;

-- Link the public topping products as quantity-aware side items for main dishes.
WITH side_links AS (
    SELECT jsonb_agg(
               jsonb_build_object('modelId', id::text, 'maxQty', 5)
               ORDER BY model_code
           )::text AS payload
    FROM model
    WHERE tenant_id='019a2026-0000-7000-8000-000000000001'
      AND category IN ('TOPPING BÁNH TRÁNG','MIX THÊM')
)
UPDATE model m
SET allowed_side_ids = side_links.payload
FROM side_links
WHERE m.tenant_id='019a2026-0000-7000-8000-000000000001'
  AND m.category NOT IN ('TOPPING BÁNH TRÁNG','MIX THÊM','TOPPING THÊM','TRÀ SỮA','TRÀ TRÁI CÂY','LATTE / SỮA TƯƠI');

-- Login/account scoping used by the application.
ALTER TABLE usertb
    ADD COLUMN IF NOT EXISTS lasttenantid varchar(36),
    ADD COLUMN IF NOT EXISTS lastcompanyid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedtenantid varchar(36),
    ADD COLUMN IF NOT EXISTS assignedcompanyid varchar(36);

-- BCrypt cost 13; plaintext password requested by owner: hkm2026
INSERT INTO usertb (
    username, password, firstname, lastname, email,
    isaccountnonexpired, isaccountnonlocked, iscredentialsnonexpired,
    isallowmarketing, isenabled, createdtime, validationcode, leaderid,
    lasttenantid, lastcompanyid, assignedtenantid, assignedcompanyid
)
VALUES (
    'hkm2026',
    '$2a$13$mvLCB5/d75FL/h1b5gT5iecn14Un3Oyc8pC/JNw9yW6iUNWUcuWzW',
    'HKM', '2026', 'hkm2026@anhmedia.vn',
    TRUE, TRUE, TRUE, FALSE, TRUE, NOW(), '', 0,
    '019a2026-0000-7000-8000-000000000001',
    '019a2026-0000-7000-8000-000000000002',
    '019a2026-0000-7000-8000-000000000001',
    '019a2026-0000-7000-8000-000000000002'
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
SELECT 'hkm2026', 'ROLE_USER', 'HKM 2026 shop user', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM authorities WHERE username='hkm2026' AND authority='ROLE_USER'
);

COMMIT;

-- Verification:
-- SELECT category, COUNT(*) FROM model
-- WHERE tenant_id='019a2026-0000-7000-8000-000000000001'
-- GROUP BY category ORDER BY category;
-- SELECT COUNT(*) AS menu_items FROM model
-- WHERE tenant_id='019a2026-0000-7000-8000-000000000001';
-- SELECT username, isenabled, assignedtenantid, assignedcompanyid
-- FROM usertb WHERE username='hkm2026';
