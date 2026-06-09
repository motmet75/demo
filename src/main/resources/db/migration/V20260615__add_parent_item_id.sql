-- Add parent_item_id to shop_order_item for recursive tree (main item → side/topping items)
ALTER TABLE shop_order_item ADD COLUMN IF NOT EXISTS parent_item_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_soi_parent_item'
      AND table_name      = 'shop_order_item'
  ) THEN
    ALTER TABLE shop_order_item
      ADD CONSTRAINT fk_soi_parent_item
      FOREIGN KEY (parent_item_id) REFERENCES shop_order_item(id) ON DELETE SET NULL;
  END IF;
END $$;
