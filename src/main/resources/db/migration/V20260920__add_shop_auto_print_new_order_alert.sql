ALTER TABLE company
    ADD COLUMN IF NOT EXISTS shop_auto_print_new_order_alert BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE company
    ADD COLUMN IF NOT EXISTS shop_customer_order_print_alert_scope VARCHAR(30) NOT NULL DEFAULT 'OFF';
