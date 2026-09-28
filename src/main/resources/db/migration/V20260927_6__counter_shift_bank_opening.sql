ALTER TABLE shop_counter_shift
    ADD COLUMN IF NOT EXISTS previous_bank numeric;

ALTER TABLE shop_counter_shift
    ADD COLUMN IF NOT EXISTS opening_bank numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shop_counter_shift_opening_bank_nonnegative'
    ) THEN
        ALTER TABLE shop_counter_shift
            ADD CONSTRAINT shop_counter_shift_opening_bank_nonnegative CHECK (opening_bank >= 0);
    END IF;
END $$;
