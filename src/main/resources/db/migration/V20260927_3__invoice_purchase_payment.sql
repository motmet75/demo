ALTER TABLE invoice
    ADD COLUMN IF NOT EXISTS payment_method varchar(20),
    ADD COLUMN IF NOT EXISTS paid_at timestamptz,
    ADD COLUMN IF NOT EXISTS payment_note_id uuid,
    ADD COLUMN IF NOT EXISTS payment_notes text;

ALTER TABLE shop_payment_note
    ADD COLUMN IF NOT EXISTS payment_method varchar(20) NOT NULL DEFAULT 'CASH',
    ADD COLUMN IF NOT EXISTS invoice_id uuid;

CREATE INDEX IF NOT EXISTS idx_shop_payment_note_invoice
    ON shop_payment_note (tenant_id, company_id, invoice_id);
