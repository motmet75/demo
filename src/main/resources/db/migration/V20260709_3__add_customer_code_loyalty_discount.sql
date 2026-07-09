ALTER TABLE shop_customer ADD COLUMN IF NOT EXISTS customer_code varchar(20);

UPDATE shop_customer
SET customer_code = upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE customer_code IS NULL OR trim(customer_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_customer_scope_code
    ON shop_customer(tenant_id, company_id, customer_code)
    WHERE customer_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shop_customer_code ON shop_customer(customer_code);

ALTER TABLE company ADD COLUMN IF NOT EXISTS loyalty_discount_point_threshold int NOT NULL DEFAULT 0;
ALTER TABLE company ADD COLUMN IF NOT EXISTS loyalty_discount_percent numeric(5, 2) NOT NULL DEFAULT 0;