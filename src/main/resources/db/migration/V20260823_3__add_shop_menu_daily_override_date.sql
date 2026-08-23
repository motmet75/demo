ALTER TABLE model
    ADD COLUMN IF NOT EXISTS shop_available_units_override_date DATE;

UPDATE model
SET shop_available_units_override_date = CURRENT_DATE
WHERE shop_available_units_override IS NOT NULL
  AND shop_available_units_override_date IS NULL;
