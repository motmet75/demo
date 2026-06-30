ALTER TABLE IF EXISTS shop_staff_call
    ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES shop_order(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS order_number integer,
    ADD COLUMN IF NOT EXISTS daily_seq integer,
    ADD COLUMN IF NOT EXISTS order_code varchar(50);

CREATE INDEX IF NOT EXISTS idx_shop_staff_call_order ON shop_staff_call(order_id);