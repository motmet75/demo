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
    shopee_thumbnail_url text NOT NULL
) ON COMMIT DROP;

INSERT INTO san_shopee_product_images (
    model_code,
    shopee_product_name,
    shopee_thumbnail_url
)
VALUES
    -- Best visual match for the owner-supplied ShopeeFood product image.
    ('SAN-022', 'Cà phê sữa',
     'https://mms.img.susercontent.com/vn-11134517-81ztc-mrzcfspmx9fk6f@resize_ss400x400!@crop_w400_h400_cT');

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
