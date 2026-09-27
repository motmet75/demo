ALTER TABLE shop_payment_note
    ADD COLUMN IF NOT EXISTS note_type varchar(20) NOT NULL DEFAULT 'EXPENSE',
    ADD COLUMN IF NOT EXISTS inventory_movement_id uuid;

DROP INDEX IF EXISTS idx_shop_payment_note_movement;
CREATE UNIQUE INDEX idx_shop_payment_note_movement
    ON shop_payment_note (tenant_id, company_id, inventory_movement_id);

CREATE INDEX IF NOT EXISTS idx_shop_payment_note_shift_totals
    ON shop_payment_note (tenant_id, company_id, note_type, payment_method, created_at);
