ALTER TABLE company
    ADD COLUMN IF NOT EXISTS shop_counter_public_ip VARCHAR(100);

ALTER TABLE company
    ADD COLUMN IF NOT EXISTS shop_counter_public_ip_updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE company
    ADD COLUMN IF NOT EXISTS shop_allowed_public_ips TEXT;

UPDATE company
SET shop_allowed_public_ips = shop_counter_public_ip
WHERE shop_allowed_public_ips IS NULL
  AND shop_counter_public_ip IS NOT NULL
  AND shop_counter_public_ip <> '';