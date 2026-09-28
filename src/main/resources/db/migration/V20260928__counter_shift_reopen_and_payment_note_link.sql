ALTER TABLE shop_counter_shift
    ADD COLUMN IF NOT EXISTS reopened_from_shift_id uuid REFERENCES shop_counter_shift(id);

ALTER TABLE shop_counter_shift
    ADD COLUMN IF NOT EXISTS reopened_by text;

ALTER TABLE shop_counter_shift
    ADD COLUMN IF NOT EXISTS assigned_to text;

ALTER TABLE shop_payment_note
    ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shop_counter_shift(id);

CREATE INDEX IF NOT EXISTS idx_shop_payment_note_shift
    ON shop_payment_note(shift_id, created_at);

-- Link older notes to the shift that was actually open when the note was made.
UPDATE shop_payment_note note
SET shift_id = (
    SELECT shift.id
    FROM shop_counter_shift shift
    WHERE shift.tenant_id = note.tenant_id
      AND shift.company_id = note.company_id
      AND note.created_at >= shift.opened_at
      AND note.created_at < COALESCE(shift.closed_at, 'infinity'::timestamptz)
    ORDER BY shift.opened_at DESC
    LIMIT 1
)
WHERE note.shift_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM shop_counter_shift shift
      WHERE shift.tenant_id = note.tenant_id
        AND shift.company_id = note.company_id
        AND note.created_at >= shift.opened_at
        AND note.created_at < COALESCE(shift.closed_at, 'infinity'::timestamptz)
  );
