-- English, Simplified Chinese, and Japanese customer-ordering translations
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
WITH menu_translation(model_code, english_name, chinese_name, japanese_name) AS (
    VALUES
        ('SAN-001', 'Mango Passion Fruit Tea', '芒果百香果茶', 'マンゴーパッションフルーツティー'),
        ('SAN-002', 'Peach Tea', '桃子茶', 'ピーチティー'),
        ('SAN-003', 'Soursop Tea', '刺果番荔枝茶', 'サワーソップティー'),
        ('SAN-004', 'Pink Guava Tea', '粉红番石榴茶', 'ピンクグアバティー'),
        ('SAN-005', 'Strawberry Tea', '草莓茶', 'ストロベリーティー'),
        ('SAN-006', 'Lemon Tea', '柠檬茶', 'レモンティー'),
        ('SAN-007', 'Kumquat Black Tea', '金桔红茶', 'キンカン紅茶'),
        ('SAN-008', 'Orange Salted Plum Tea', '橙子咸梅茶', 'オレンジ塩梅ティー'),
        ('SAN-009', 'Lychee Mango Lemon Tea', '荔枝芒果柠檬茶', 'ライチマンゴーレモンティー'),
        ('SAN-010', 'Oolong Milk Tea', '乌龙奶茶', 'ウーロンミルクティー'),
        ('SAN-011', 'Jasmine Milk Tea', '茉莉奶茶', 'ジャスミンミルクティー'),
        ('SAN-012', 'Jasmine Oolong Milk Tea', '茉莉乌龙奶茶', 'ジャスミンウーロンミルクティー'),
        ('SAN-013', 'Black Milk Tea', '红茶奶茶', '紅茶ミルクティー'),
        ('SAN-014', 'Strawberry Soda', '草莓苏打', 'ストロベリーソーダ'),
        ('SAN-015', 'Kiwi Soda', '奇异果苏打', 'キウイソーダ'),
        ('SAN-016', 'Blueberry Soda', '蓝莓苏打', 'ブルーベリーソーダ'),
        ('SAN-017', 'Mango Soda', '芒果苏打', 'マンゴーソーダ'),
        ('SAN-018', 'Passion Fruit Soda', '百香果苏打', 'パッションフルーツソーダ'),
        ('SAN-019', 'Salt Coffee', '盐咖啡', '塩コーヒー'),
        ('SAN-020', 'Iced Coffee', '冰咖啡', 'アイスコーヒー'),
        ('SAN-021', 'Fresh Milk Coffee', '鲜奶咖啡', 'フレッシュミルクコーヒー'),
        ('SAN-022', 'Condensed Milk Coffee', '炼乳咖啡', '練乳コーヒー'),
        ('SAN-023', 'Matcha Latte', '抹茶拿铁', '抹茶ラテ'),
        ('SAN-024', 'Coconut Matcha', '椰香抹茶', 'ココナッツ抹茶'),
        ('SAN-025', 'Cheese Foam Matcha', '芝士奶盖抹茶', 'チーズフォーム抹茶'),
        ('SAN-026', 'Black Tapioca Pearls', '黑珍珠', 'ブラックタピオカ'),
        ('SAN-027', 'Coconut Jelly Strips', '椰果丝', 'ココナッツゼリー'),
        ('SAN-028', 'Peach', '桃子', 'ピーチ'),
        ('SAN-029', 'Cheese Foam', '芝士奶盖', 'チーズフォーム')
)
UPDATE model m
SET model_name_translations = (
        COALESCE(NULLIF(m.model_name_translations, ''), '{}')::jsonb
        || jsonb_build_object(
            'en', menu_translation.english_name,
            'cn', menu_translation.chinese_name,
            'ja', menu_translation.japanese_name
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
            'ja', category_translation.japanese_name
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
            'ja', group_translation.japanese_name
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
