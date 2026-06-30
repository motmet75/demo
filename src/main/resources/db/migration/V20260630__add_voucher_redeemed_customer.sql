ALTER TABLE shop_voucher ADD COLUMN IF NOT EXISTS redeemed_customer_id uuid;
ALTER TABLE shop_voucher ADD COLUMN IF NOT EXISTS redeemed_customer_name varchar(150);

CREATE INDEX IF NOT EXISTS idx_shop_voucher_redeemed_customer
    ON shop_voucher(tenant_id, company_id, redeemed_customer_id);