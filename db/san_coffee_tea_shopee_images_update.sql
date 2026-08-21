-- SAN Coffee and Tea - Tên Lửa: replace generated thumbnails with
-- full-resolution ShopeeFood product images.
--
-- ShopeeFood commonly appends transformations such as:
--   @resize_ss400x400!@crop_w400_h400_cT
-- split_part(..., '@', 1) removes that entire suffix before image_url is saved.
--
-- Source listing:
-- https://shopeefood.vn/ho-chi-minh/san-coffee-and-tea-ten-lua
-- Rerunnable after db/san_coffee_tea_shop_seed.sql.

BEGIN;

CREATE TEMP TABLE san_shopee_product_images (
    model_code varchar(50) PRIMARY KEY,
    shopee_product_name text NOT NULL,
    shopee_price numeric(15,2) NOT NULL,
    shopee_thumbnail_url text NOT NULL
) ON COMMIT DROP;

INSERT INTO san_shopee_product_images (
    model_code,
    shopee_product_name,
    shopee_price,
    shopee_thumbnail_url
)
VALUES
    -- Product names, prices and image IDs extracted from the saved ShopeeFood
    -- listing page. Prices are retained here for comparison but are not copied
    -- to model.selling_price because Shopee delivery pricing is higher than the
    -- shop-owner menu-board pricing used by the direct-order storefront.
    ('SAN-010', 'Trà Sữa Ô Long',       50000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcfspmx9fk6f'),
    ('SAN-011', 'Trà Sữa Lài',          45000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcg53sxz4072'),
    ('SAN-012', 'Trà Sữa Ô Long Lài',   50000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzchqk8y5fk67'),
    ('SAN-013', 'Hồng Trà Sữa',         45000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzci336c5c435'),
    ('SAN-014', 'Soda Dâu',             35000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzccb47ekua55'),
    ('SAN-015', 'Soda Kiwi',            35000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcco645uyo6e'),
    ('SAN-016', 'Soda Việt Quất',       35000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcd04ge9l1be'),
    ('SAN-017', 'Soda Xoài',            35000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcdzd9oq9t37'),
    ('SAN-018', 'Soda Chanh Dây',       35000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzceb0aluko2d'),
    ('SAN-007', 'Hồng Trà Tắc',         35000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzclatjrklg79'),
    ('SAN-003', 'Trà Mãng Cầu',         45000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcj74as2yp01'),
    ('SAN-005', 'Trà Dâu',              45000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzck7cwrsav73'),
    ('SAN-008', 'Trà Cam Xí Muội',      45000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcllw3nzt021'),
    ('SAN-004', 'Trà Ổi Hồng',          45000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcjnijwtfrd2'),
    ('SAN-006', 'Trà Chanh',            35000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzckxnglb7p09'),
    ('SAN-001', 'Trà Xoài Chanh Dây',   50000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcihla9g5kcb'),
    ('SAN-022', 'Cà Phê Sữa',           35000, 'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcbnpof2te2d');

UPDATE model AS product
SET image_url = split_part(source.shopee_thumbnail_url, '@', 1)
FROM san_shopee_product_images AS source
WHERE product.model_code = source.model_code
  AND product.tenant_id = '019b5a10-0000-7000-8000-000000000001'
  AND product.company_id = '019b5a10-0000-7000-8000-000000000002';

-- Refuse to silently succeed if a mapped SAN product is absent.
DO $$
DECLARE
    missing_products text;
BEGIN
    SELECT string_agg(source.model_code || ' (' || source.shopee_product_name || ')', ', ')
      INTO missing_products
      FROM san_shopee_product_images AS source
      LEFT JOIN model AS product
        ON product.model_code = source.model_code
       AND product.tenant_id = '019b5a10-0000-7000-8000-000000000001'
       AND product.company_id = '019b5a10-0000-7000-8000-000000000002'
     WHERE product.id IS NULL;

    IF missing_products IS NOT NULL THEN
        RAISE EXCEPTION 'SAN products not found: %', missing_products;
    END IF;
END $$;

COMMIT;

-- Verification:
-- SELECT model_code, model_name, image_url
-- FROM model
-- WHERE tenant_id = '019b5a10-0000-7000-8000-000000000001'
--   AND company_id = '019b5a10-0000-7000-8000-000000000002'
--   AND image_url LIKE 'https://mms.img.susercontent.com/%'
-- ORDER BY model_code;
