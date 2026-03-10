-- Add quantity_total column to inventory table
-- Represents the total cumulative quantity ever received for a batch.
-- Defaults to quantity_on_hand for existing rows.
ALTER TABLE inventory
    ADD COLUMN IF NOT EXISTS quantity_total NUMERIC(18,3) DEFAULT 0;

-- Back-fill existing rows: set quantity_total = quantity_on_hand
UPDATE inventory SET quantity_total = quantity_on_hand WHERE quantity_total IS NULL OR quantity_total = 0;
