-- Customer-ordering translations for every language supported by the BOM shop:
-- vi, en, cn, tw, ja, ko, es, dv, ms, id, th.
-- for SAN Coffee and Tea - Ten Lua.
-- PostgreSQL UTF-8. Rerunnable and strictly scoped to the SAN tenant/company.
-- Apply after V20260717__add_menu_translation_fields.sql and san_coffee_tea_shop_seed.sql.

BEGIN;

ALTER TABLE model
    ADD COLUMN IF NOT EXISTS model_name_translations TEXT,
    ADD COLUMN IF NOT EXISTS category_translations TEXT;

ALTER TABLE model_menu_option
    ADD COLUMN IF NOT EXISTS group_name_translations TEXT;

-- Product names: merge en/cn/ja without removing translations for other languages.
WITH menu_translation(model_code, english_name, chinese_name, japanese_name, korean_name) AS (
    VALUES
        ('SAN-001', 'Mango Passion Fruit Tea', '芒果百香果茶', 'マンゴーパッションフルーツティー', '망고 패션후르츠 티'),
        ('SAN-002', 'Peach Tea', '桃子茶', 'ピーチティー', '복숭아 티'),
        ('SAN-003', 'Soursop Tea', '刺果番荔枝茶', 'サワーソップティー', '사워솝 티'),
        ('SAN-004', 'Pink Guava Tea', '粉红番石榴茶', 'ピンクグアバティー', '핑크 구아바 티'),
        ('SAN-005', 'Strawberry Tea', '草莓茶', 'ストロベリーティー', '딸기 티'),
        ('SAN-006', 'Lemon Tea', '柠檬茶', 'レモンティー', '레몬 티'),
        ('SAN-007', 'Kumquat Black Tea', '金桔红茶', 'キンカン紅茶', '금귤 홍차'),
        ('SAN-008', 'Orange Salted Plum Tea', '橙子咸梅茶', 'オレンジ塩梅ティー', '오렌지 소금매실 티'),
        ('SAN-009', 'Lychee Mango Lemon Tea', '荔枝芒果柠檬茶', 'ライチマンゴーレモンティー', '리치 망고 레몬 티'),
        ('SAN-010', 'Oolong Milk Tea', '乌龙奶茶', 'ウーロンミルクティー', '우롱 밀크티'),
        ('SAN-011', 'Jasmine Milk Tea', '茉莉奶茶', 'ジャスミンミルクティー', '자스민 밀크티'),
        ('SAN-012', 'Jasmine Oolong Milk Tea', '茉莉乌龙奶茶', 'ジャスミンウーロンミルクティー', '자스민 우롱 밀크티'),
        ('SAN-013', 'Black Milk Tea', '红茶奶茶', '紅茶ミルクティー', '홍차 밀크티'),
        ('SAN-014', 'Strawberry Soda', '草莓苏打', 'ストロベリーソーダ', '딸기 소다'),
        ('SAN-015', 'Kiwi Soda', '奇异果苏打', 'キウイソーダ', '키위 소다'),
        ('SAN-016', 'Blueberry Soda', '蓝莓苏打', 'ブルーベリーソーダ', '블루베리 소다'),
        ('SAN-017', 'Mango Soda', '芒果苏打', 'マンゴーソーダ', '망고 소다'),
        ('SAN-018', 'Passion Fruit Soda', '百香果苏打', 'パッションフルーツソーダ', '패션후르츠 소다'),
        ('SAN-019', 'Salt Coffee', '盐咖啡', '塩コーヒー', '소금 커피'),
        ('SAN-020', 'Iced Coffee', '冰咖啡', 'アイスコーヒー', '아이스 커피'),
        ('SAN-021', 'Fresh Milk Coffee', '鲜奶咖啡', 'フレッシュミルクコーヒー', '생우유 커피'),
        ('SAN-022', 'Condensed Milk Coffee', '炼乳咖啡', '練乳コーヒー', '연유 커피'),
        ('SAN-023', 'Matcha Latte', '抹茶拿铁', '抹茶ラテ', '말차 라테'),
        ('SAN-024', 'Coconut Matcha', '椰香抹茶', 'ココナッツ抹茶', '코코넛 말차'),
        ('SAN-025', 'Cheese Foam Matcha', '芝士奶盖抹茶', 'チーズフォーム抹茶', '치즈폼 말차'),
        ('SAN-026', 'Black Tapioca Pearls', '黑珍珠', 'ブラックタピオカ', '블랙 타피오카 펄'),
        ('SAN-027', 'Coconut Jelly Strips', '椰果丝', 'ココナッツゼリー', '코코넛 젤리'),
        ('SAN-028', 'Peach', '桃子', 'ピーチ', '복숭아'),
        ('SAN-029', 'Cheese Foam', '芝士奶盖', 'チーズフォーム', '치즈폼')
)
UPDATE model m
SET model_name_translations = (
        COALESCE(NULLIF(m.model_name_translations, ''), '{}')::jsonb
        || jsonb_build_object(
            'en', menu_translation.english_name,
            'cn', menu_translation.chinese_name,
            'tw', menu_translation.chinese_name,
            'ja', menu_translation.japanese_name,
            'ko', menu_translation.korean_name,
            'es', menu_translation.english_name,
            'dv', menu_translation.english_name,
            'ms', menu_translation.english_name,
            'id', menu_translation.english_name,
            'vi', m.model_name,
            'th', menu_translation.english_name
        )
    )::text
FROM menu_translation
WHERE m.model_code = menu_translation.model_code
  AND m.tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND m.company_id = '019b5a10-0000-7000-8000-000000000002';

-- Category labels shown in the ordering menu.
WITH category_translation(category, english_name, chinese_name, japanese_name) AS (
    VALUES
        ('TRÀ TRÁI CÂY', 'Fruit Tea', '水果茶', 'フルーツティー'),
        ('TRÀ SỮA',      'Milk Tea',  '奶茶',   'ミルクティー'),
        ('SODA',         'Soda',      '苏打饮料', 'ソーダ'),
        ('COFFEE',       'Coffee',    '咖啡',   'コーヒー'),
        ('MATCHA',       'Matcha',    '抹茶',   '抹茶'),
        ('TOPPING',      'Toppings',  '加料',   'トッピング')
)
UPDATE model m
SET category_translations = (
        COALESCE(NULLIF(m.category_translations, ''), '{}')::jsonb
        || jsonb_build_object(
            'en', category_translation.english_name,
            'cn', category_translation.chinese_name,
            'tw', category_translation.chinese_name,
            'ja', category_translation.japanese_name,
            'ko', CASE m.category WHEN 'TRÀ TRÁI CÂY' THEN '과일차' WHEN 'TRÀ SỮA' THEN '밀크티' WHEN 'SODA' THEN '소다' WHEN 'COFFEE' THEN '커피' WHEN 'MATCHA' THEN '말차' ELSE '토핑' END,
            'es', CASE m.category WHEN 'TRÀ TRÁI CÂY' THEN 'Té de frutas' WHEN 'TRÀ SỮA' THEN 'Té con leche' WHEN 'SODA' THEN 'Refrescos' WHEN 'COFFEE' THEN 'Café' WHEN 'MATCHA' THEN 'Matcha' ELSE 'Extras' END,
            'dv', category_translation.english_name,
            'ms', CASE m.category WHEN 'TRÀ TRÁI CÂY' THEN 'Teh Buah' WHEN 'TRÀ SỮA' THEN 'Teh Susu' WHEN 'SODA' THEN 'Soda' WHEN 'COFFEE' THEN 'Kopi' WHEN 'MATCHA' THEN 'Matcha' ELSE 'Tambahan' END,
            'id', CASE m.category WHEN 'TRÀ TRÁI CÂY' THEN 'Teh Buah' WHEN 'TRÀ SỮA' THEN 'Teh Susu' WHEN 'SODA' THEN 'Soda' WHEN 'COFFEE' THEN 'Kopi' WHEN 'MATCHA' THEN 'Matcha' ELSE 'Topping' END,
            'vi', CASE m.category
                WHEN 'TRÀ TRÁI CÂY' THEN 'TRÀ TRÁI CÂY'
                WHEN 'TRÀ SỮA' THEN 'TRÀ SỮA'
                WHEN 'SODA' THEN 'NƯỚC SODA'
                WHEN 'COFFEE' THEN 'CÀ PHÊ'
                WHEN 'MATCHA' THEN 'MATCHA'
                ELSE 'MÓN THÊM'
            END,
            'th', CASE m.category WHEN 'TRÀ TRÁI CÂY' THEN 'ชาผลไม้' WHEN 'TRÀ SỮA' THEN 'ชานม' WHEN 'SODA' THEN 'โซดา' WHEN 'COFFEE' THEN 'กาแฟ' WHEN 'MATCHA' THEN 'มัทฉะ' ELSE 'ท็อปปิ้ง' END
        )
    )::text
FROM category_translation
WHERE m.category = category_translation.category
  AND m.tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND m.company_id = '019b5a10-0000-7000-8000-000000000002'
  AND m.model_code LIKE 'SAN-%';

-- Option group labels. Base Vietnamese group names remain the stable order values.
WITH group_translation(group_name, english_name, chinese_name, japanese_name) AS (
    VALUES
        ('Kích cỡ',   'Size',     '尺寸', 'サイズ'),
        ('Mức đường', 'Sweetness','甜度', '甘さ'),
        ('Mức đá',    'Ice Level','冰量', '氷の量'),
        ('Topping',   'Toppings', '加料', 'トッピング')
)
UPDATE model_menu_option option_row
SET group_name_translations = (
        COALESCE(NULLIF(option_row.group_name_translations, ''), '{}')::jsonb
        || jsonb_build_object(
            'en', group_translation.english_name,
            'cn', group_translation.chinese_name,
            'tw', group_translation.chinese_name,
            'ja', group_translation.japanese_name,
            'ko', CASE option_row.group_name WHEN 'Kích cỡ' THEN '사이즈' WHEN 'Mức đường' THEN '당도' WHEN 'Mức đá' THEN '얼음 양' ELSE '토핑' END,
            'es', CASE option_row.group_name WHEN 'Kích cỡ' THEN 'Tamaño' WHEN 'Mức đường' THEN 'Dulzor' WHEN 'Mức đá' THEN 'Nivel de hielo' ELSE 'Extras' END,
            'dv', group_translation.english_name,
            'ms', CASE option_row.group_name WHEN 'Kích cỡ' THEN 'Saiz' WHEN 'Mức đường' THEN 'Kemanisan' WHEN 'Mức đá' THEN 'Tahap Ais' ELSE 'Tambahan' END,
            'id', CASE option_row.group_name WHEN 'Kích cỡ' THEN 'Ukuran' WHEN 'Mức đường' THEN 'Tingkat Gula' WHEN 'Mức đá' THEN 'Tingkat Es' ELSE 'Topping' END,
            'vi', option_row.group_name,
            'th', CASE option_row.group_name WHEN 'Kích cỡ' THEN 'ขนาด' WHEN 'Mức đường' THEN 'ระดับความหวาน' WHEN 'Mức đá' THEN 'ระดับน้ำแข็ง' ELSE 'ท็อปปิ้ง' END
        )
    )::text
FROM group_translation
WHERE option_row.group_name = group_translation.group_name
  AND option_row.tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND option_row.company_id = '019b5a10-0000-7000-8000-000000000002';

-- Size choices for the two coffee products with S/L pricing.
UPDATE model_menu_option
SET choices = '[
  {"label":"Size S","price":0,"labelTranslations":{"en":"Small","cn":"小杯","ja":"Sサイズ"}},
  {"label":"Size L","price":20000,"labelTranslations":{"en":"Large","cn":"大杯","ja":"Lサイズ"}}
]'
WHERE group_name = 'Kích cỡ'
  AND tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND company_id = '019b5a10-0000-7000-8000-000000000002';

-- Sugar choices use internationally recognizable percentages while still carrying cn labels.
UPDATE model_menu_option
SET choices = '[
  {"label":"0%","price":0,"labelTranslations":{"en":"0% Sugar","cn":"0%糖","ja":"砂糖0%"}},
  {"label":"30%","price":0,"labelTranslations":{"en":"30% Sugar","cn":"30%糖","ja":"砂糖30%"}},
  {"label":"50%","price":0,"labelTranslations":{"en":"50% Sugar","cn":"50%糖","ja":"砂糖50%"}},
  {"label":"70%","price":0,"labelTranslations":{"en":"70% Sugar","cn":"70%糖","ja":"砂糖70%"}},
  {"label":"100%","price":0,"labelTranslations":{"en":"100% Sugar","cn":"100%糖","ja":"砂糖100%"}}
]'
WHERE group_name = 'Mức đường'
  AND tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND company_id = '019b5a10-0000-7000-8000-000000000002';

UPDATE model_menu_option
SET choices = '[
  {"label":"Không đá","price":0,"labelTranslations":{"en":"No Ice","cn":"去冰","ja":"氷なし"}},
  {"label":"Ít đá","price":0,"labelTranslations":{"en":"Less Ice","cn":"少冰","ja":"氷少なめ"}},
  {"label":"Đá bình thường","price":0,"labelTranslations":{"en":"Regular Ice","cn":"正常冰","ja":"氷普通"}},
  {"label":"Nhiều đá","price":0,"labelTranslations":{"en":"Extra Ice","cn":"多冰","ja":"氷多め"}}
]'
WHERE group_name = 'Mức đá'
  AND tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND company_id = '019b5a10-0000-7000-8000-000000000002';

UPDATE model_menu_option
SET choices = '[
  {"label":"Trân châu đen","price":5000,"labelTranslations":{"en":"Black Tapioca Pearls","cn":"黑珍珠","ja":"ブラックタピオカ"}},
  {"label":"Thạch dừa sợi","price":5000,"labelTranslations":{"en":"Coconut Jelly Strips","cn":"椰果丝","ja":"ココナッツゼリー"}},
  {"label":"Đào","price":7000,"labelTranslations":{"en":"Peach","cn":"桃子","ja":"ピーチ"}},
  {"label":"Kem Cheese","price":10000,"labelTranslations":{"en":"Cheese Foam","cn":"芝士奶盖","ja":"チーズフォーム"}}
]'
WHERE group_name = 'Topping'
  AND tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND company_id = '019b5a10-0000-7000-8000-000000000002';

-- Complete every choice with all supported language keys. Dhivehi uses the
-- internationally recognizable English menu term where no stable local food term exists.
UPDATE model_menu_option option_row
SET choices = (
    SELECT jsonb_agg(
        choice || jsonb_build_object(
            'labelTranslations',
            COALESCE(choice -> 'labelTranslations', '{}'::jsonb)
            || jsonb_build_object(
                'tw', COALESCE(choice -> 'labelTranslations' ->> 'cn', choice ->> 'label'),
                'ko', CASE choice ->> 'label'
                    WHEN 'Size S' THEN '작은 사이즈' WHEN 'Size L' THEN '큰 사이즈'
                    WHEN 'Không đá' THEN '얼음 없음' WHEN 'Ít đá' THEN '얼음 적게'
                    WHEN 'Đá bình thường' THEN '얼음 보통' WHEN 'Nhiều đá' THEN '얼음 많이'
                    WHEN 'Trân châu đen' THEN '블랙 타피오카 펄' WHEN 'Thạch dừa sợi' THEN '코코넛 젤리'
                    WHEN 'Đào' THEN '복숭아' WHEN 'Kem Cheese' THEN '치즈폼'
                    ELSE (choice ->> 'label') || ' 설탕' END,
                'es', CASE choice ->> 'label'
                    WHEN 'Size S' THEN 'Pequeño' WHEN 'Size L' THEN 'Grande'
                    WHEN 'Không đá' THEN 'Sin hielo' WHEN 'Ít đá' THEN 'Poco hielo'
                    WHEN 'Đá bình thường' THEN 'Hielo normal' WHEN 'Nhiều đá' THEN 'Hielo extra'
                    WHEN 'Trân châu đen' THEN 'Perlas de tapioca' WHEN 'Thạch dừa sợi' THEN 'Gelatina de coco'
                    WHEN 'Đào' THEN 'Melocotón' WHEN 'Kem Cheese' THEN 'Espuma de queso'
                    ELSE (choice ->> 'label') || ' azúcar' END,
                'dv', COALESCE(choice -> 'labelTranslations' ->> 'en', choice ->> 'label'),
                'ms', CASE choice ->> 'label'
                    WHEN 'Size S' THEN 'Kecil' WHEN 'Size L' THEN 'Besar'
                    WHEN 'Không đá' THEN 'Tanpa Ais' WHEN 'Ít đá' THEN 'Kurang Ais'
                    WHEN 'Đá bình thường' THEN 'Ais Biasa' WHEN 'Nhiều đá' THEN 'Lebih Ais'
                    WHEN 'Trân châu đen' THEN 'Mutiara Tapioka Hitam' WHEN 'Thạch dừa sợi' THEN 'Jeli Kelapa'
                    WHEN 'Đào' THEN 'Pic' WHEN 'Kem Cheese' THEN 'Buih Keju'
                    ELSE (choice ->> 'label') || ' Gula' END,
                'id', CASE choice ->> 'label'
                    WHEN 'Size S' THEN 'Kecil' WHEN 'Size L' THEN 'Besar'
                    WHEN 'Không đá' THEN 'Tanpa Es' WHEN 'Ít đá' THEN 'Sedikit Es'
                    WHEN 'Đá bình thường' THEN 'Es Normal' WHEN 'Nhiều đá' THEN 'Ekstra Es'
                    WHEN 'Trân châu đen' THEN 'Mutiara Tapioka Hitam' WHEN 'Thạch dừa sợi' THEN 'Jeli Kelapa'
                    WHEN 'Đào' THEN 'Persik' WHEN 'Kem Cheese' THEN 'Busa Keju'
                    ELSE (choice ->> 'label') || ' Gula' END,
                'vi', choice ->> 'label',
                'th', CASE choice ->> 'label'
                    WHEN 'Size S' THEN 'แก้วเล็ก' WHEN 'Size L' THEN 'แก้วใหญ่'
                    WHEN 'Không đá' THEN 'ไม่ใส่น้ำแข็ง' WHEN 'Ít đá' THEN 'น้ำแข็งน้อย'
                    WHEN 'Đá bình thường' THEN 'น้ำแข็งปกติ' WHEN 'Nhiều đá' THEN 'น้ำแข็งมาก'
                    WHEN 'Trân châu đen' THEN 'ไข่มุกดำ' WHEN 'Thạch dừa sợi' THEN 'วุ้นมะพร้าว'
                    WHEN 'Đào' THEN 'พีช' WHEN 'Kem Cheese' THEN 'ชีสโฟม'
                    ELSE 'น้ำตาล ' || (choice ->> 'label') END
            )
        )
        ORDER BY ordinal
    )::text
    FROM jsonb_array_elements(option_row.choices::jsonb) WITH ORDINALITY AS parsed(choice, ordinal)
)
WHERE option_row.tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND option_row.company_id = '019b5a10-0000-7000-8000-000000000002'
  AND option_row.group_name IN ('Kích cỡ', 'Mức đường', 'Mức đá', 'Topping');

COMMIT;

-- Verification: every active SAN item should have non-empty English, Chinese, and Japanese values.
SELECT model_code, model_name,
       model_name_translations::jsonb ->> 'en' AS english_name,
       model_name_translations::jsonb ->> 'cn' AS chinese_name,
       model_name_translations::jsonb ->> 'ja' AS japanese_name,
       category_translations::jsonb ->> 'en' AS english_category,
       category_translations::jsonb ->> 'cn' AS chinese_category,
       category_translations::jsonb ->> 'ja' AS japanese_category
FROM model
WHERE tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND company_id = '019b5a10-0000-7000-8000-000000000002'
  AND model_code LIKE 'SAN-%'
ORDER BY model_code;

SELECT group_name,
       group_name_translations::jsonb ->> 'en' AS english_group,
       group_name_translations::jsonb ->> 'cn' AS chinese_group,
       group_name_translations::jsonb ->> 'ja' AS japanese_group,
       choices::jsonb AS translated_choices
FROM model_menu_option
WHERE tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND company_id = '019b5a10-0000-7000-8000-000000000002'
ORDER BY display_order, group_name;
