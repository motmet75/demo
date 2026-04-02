-- Add updated_by column to order_consumption to track who last ran check-inventory
ALTER TABLE order_consumption
    ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);
