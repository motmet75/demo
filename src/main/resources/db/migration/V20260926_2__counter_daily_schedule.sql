-- Existing unnumbered handovers retain their original identity and cash history.
ALTER TABLE shop_counter_shift ADD COLUMN IF NOT EXISTS shift_number smallint
 CHECK (shift_number IN (1,2));
CREATE UNIQUE INDEX IF NOT EXISTS shop_counter_daily_slot
 ON shop_counter_shift(tenant_id,company_id,shift_date,shift_number)
 WHERE shift_number IS NOT NULL;
