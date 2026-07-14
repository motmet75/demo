ALTER TABLE shop_bill ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE shop_bill ADD COLUMN IF NOT EXISTS voucher_code varchar(50);
ALTER TABLE shop_voucher ADD COLUMN IF NOT EXISTS redeemed_bill_id uuid;

CREATE INDEX IF NOT EXISTS idx_shop_voucher_redeemed_bill
    ON shop_voucher(tenant_id, company_id, redeemed_bill_id);

UPDATE shop_bill b
SET discount_amount = COALESCE(o.discount_amount, 0),
    voucher_code = o.voucher_code
FROM shop_order o
WHERE b.order_id = o.id
  AND b.bill_number = 1
  AND COALESCE(b.discount_amount, 0) = 0
  AND (b.voucher_code IS NULL OR b.voucher_code = '')
  AND (COALESCE(o.discount_amount, 0) <> 0 OR o.voucher_code IS NOT NULL);

UPDATE shop_voucher v
SET redeemed_bill_id = b.id
FROM shop_bill b
WHERE v.redeemed_order_id = b.order_id
  AND b.bill_number = 1
  AND v.redeemed_bill_id IS NULL;