-- Add deducted_inventory_id to order_consumption_log for tracking which inventory row was deducted
ALTER TABLE order_consumption_log
    ADD COLUMN IF NOT EXISTS deducted_inventory_id UUID;
