ALTER TABLE shop_order
    ADD COLUMN IF NOT EXISTS customer_table_tag varchar(100),
    ADD COLUMN IF NOT EXISTS requested_fulfillment_at timestamptz;
