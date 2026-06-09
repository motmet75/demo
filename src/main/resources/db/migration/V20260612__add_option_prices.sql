ALTER TABLE model_menu_option ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;
ALTER TABLE shop_order_item  ADD COLUMN IF NOT EXISTS option_add_on numeric NOT NULL DEFAULT 0;
